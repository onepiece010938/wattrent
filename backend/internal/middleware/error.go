package middleware

import (
	"errors"
	"log/slog"
	"net/http"

	"github.com/getsentry/sentry-go"
	sentrygin "github.com/getsentry/sentry-go/gin"
	"github.com/gin-gonic/gin"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"wattrent/internal/models"
)

// AppError is the business-layer error type.
//
// HTTPStatus: HTTP status code to return
// Key:        i18n key (translated by the frontend)
// Cause:      original error (NEVER exposed to the client; only logged)
type AppError struct {
	HTTPStatus int
	Key        string
	Cause      error
}

func (e *AppError) Error() string {
	if e.Cause != nil {
		return e.Key + ": " + e.Cause.Error()
	}
	return e.Key
}

func (e *AppError) Unwrap() error { return e.Cause }

// Default error variants. Every i18n key is dot-separated.
var (
	ErrNotFound       = &AppError{HTTPStatus: http.StatusNotFound, Key: "errors.not_found"}
	ErrBadRequest     = &AppError{HTTPStatus: http.StatusBadRequest, Key: "errors.bad_request"}
	ErrUnauthorized   = &AppError{HTTPStatus: http.StatusUnauthorized, Key: "errors.unauthorized"}
	ErrInternal       = &AppError{HTTPStatus: http.StatusInternalServerError, Key: "errors.internal"}
	ErrUpstreamFailed = &AppError{HTTPStatus: http.StatusBadGateway, Key: "errors.upstream_failed"}
)

// ErrorHandler centralises handling of errors pushed via c.Error().
//
// Mapping order:
//  1. AppError -> use the embedded status / key
//  2. gRPC NotFound -> ErrNotFound
//  3. gin bind error -> ErrBadRequest
//  4. anything else -> ErrInternal
func ErrorHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Next()

		if len(c.Errors) == 0 {
			return
		}

		err := c.Errors.Last().Err
		appErr := mapError(err)

		// Log the full cause (never sent to the client)
		slog.Error("request failed",
			"path", c.Request.URL.Path,
			"method", c.Request.Method,
			"status", appErr.HTTPStatus,
			"key", appErr.Key,
			"requestId", RequestIDFromContext(c),
			"err", err,
		)

		// Report 5xx errors to Sentry (4xx are client-side problems and not actionable).
		// GetHubFromContext returns nil when sentrygin is not installed (e.g. SENTRY_DSN unset),
		// so this whole block is a no-op in that case.
		if appErr.HTTPStatus >= 500 {
			if hub := sentrygin.GetHubFromContext(c); hub != nil {
				hub.WithScope(func(scope *sentry.Scope) {
					scope.SetTag("error_key", appErr.Key)
					scope.SetTag("http_status", http.StatusText(appErr.HTTPStatus))
					if route := c.FullPath(); route != "" {
						scope.SetTag("route", route)
					}
					if rid := RequestIDFromContext(c); rid != "" {
						scope.SetTag("request_id", rid)
					}
					if uidVal, ok := c.Get(ContextKeyUID); ok {
						if uid, ok := uidVal.(string); ok && uid != "" {
							scope.SetUser(sentry.User{ID: uid})
						}
					}
					hub.CaptureException(err)
				})
			}
		}

		c.AbortWithStatusJSON(appErr.HTTPStatus, models.ApiResponse{
			Success: false,
			Error:   appErr.Key,
		})
	}
}

func mapError(err error) *AppError {
	var ae *AppError
	if errors.As(err, &ae) {
		return ae
	}

	if st, ok := status.FromError(err); ok {
		switch st.Code() {
		case codes.NotFound:
			return ErrNotFound
		case codes.PermissionDenied, codes.Unauthenticated:
			return ErrUnauthorized
		case codes.InvalidArgument:
			return ErrBadRequest
		case codes.Unavailable, codes.DeadlineExceeded:
			return ErrUpstreamFailed
		}
	}

	return ErrInternal
}
