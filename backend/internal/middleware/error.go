package middleware

import (
	"errors"
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"wattrent/internal/models"
)

// AppError 業務層用的錯誤型別。
//
// HTTPStatus：對應的 HTTP status code
// Key：i18n key（前端翻譯）
// Cause：原始錯誤（不會暴露給 client，只進 log）
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

// 預設錯誤型別。i18n key 全部 dot-separated。
var (
	ErrNotFound       = &AppError{HTTPStatus: http.StatusNotFound, Key: "errors.not_found"}
	ErrBadRequest     = &AppError{HTTPStatus: http.StatusBadRequest, Key: "errors.bad_request"}
	ErrUnauthorized   = &AppError{HTTPStatus: http.StatusUnauthorized, Key: "errors.unauthorized"}
	ErrInternal       = &AppError{HTTPStatus: http.StatusInternalServerError, Key: "errors.internal"}
	ErrUpstreamFailed = &AppError{HTTPStatus: http.StatusBadGateway, Key: "errors.upstream_failed"}
)

// ErrorHandler 統一處理 c.Error() 推進來的錯誤。
//
// 處理順序：
//  1. AppError → 用內含的 status / key
//  2. gRPC NotFound → ErrNotFound
//  3. gin bind error → ErrBadRequest
//  4. 其他 → ErrInternal
func ErrorHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Next()

		if len(c.Errors) == 0 {
			return
		}

		err := c.Errors.Last().Err
		appErr := mapError(err)

		// log 完整 cause（不送到 client）
		slog.Error("request failed",
			"path", c.Request.URL.Path,
			"method", c.Request.Method,
			"status", appErr.HTTPStatus,
			"key", appErr.Key,
			"err", err,
		)

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
