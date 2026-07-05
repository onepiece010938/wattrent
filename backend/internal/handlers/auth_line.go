package handlers

import (
	"context"
	"errors"
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"

	"wattrent/internal/middleware"
	"wattrent/internal/models"
	"wattrent/internal/services"
)

// LINEAuthHandler exposes POST /api/v1/auth/line/exchange.
//
// This endpoint is the ONLY unauthenticated route under /api/v1 (other than
// /health). It accepts a LINE Login OAuth 2.0 authorisation code + PKCE
// verifier from the frontend, exchanges it server-side using the channel
// secret (which never leaves the backend), and returns a Firebase custom
// token the client can use with signInWithCustomToken().
type LINEAuthHandler struct {
	svc lineExchanger
}

func NewLINEAuthHandler(svc lineExchanger) *LINEAuthHandler {
	return &LINEAuthHandler{svc: svc}
}

type lineExchangeRequest struct {
	Code         string `json:"code"          binding:"required"`
	CodeVerifier string `json:"codeVerifier"  binding:"required"`
	RedirectURI  string `json:"redirectUri"   binding:"required"`
}

type lineExchangeResponse struct {
	CustomToken string `json:"customToken"`
}

// Exchange handles POST /api/v1/auth/line/exchange.
func (h *LINEAuthHandler) Exchange(c *gin.Context) {
	var req lineExchangeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		_ = c.Error(&middleware.AppError{
			HTTPStatus: http.StatusBadRequest,
			Key:        "errors.bad_request",
		})
		return
	}

	result, err := h.svc.Exchange(c.Request.Context(), req.Code, req.CodeVerifier, req.RedirectURI)
	if err != nil {
		switch {
		case errors.Is(err, services.ErrLINEDisabled):
			_ = c.Error(&middleware.AppError{
				HTTPStatus: http.StatusServiceUnavailable,
				Key:        "errors.auth.line_disabled",
			})
		case errors.Is(err, services.ErrLINEBadRequest):
			_ = c.Error(&middleware.AppError{
				HTTPStatus: http.StatusBadRequest,
				Key:        "errors.auth.line_invalid_code",
				Cause:      err,
			})
		case errors.Is(err, services.ErrLINEBadUpstream):
			_ = c.Error(&middleware.AppError{
				HTTPStatus: http.StatusBadGateway,
				Key:        "errors.auth.line_upstream",
				Cause:      err,
			})
		default:
			slog.Warn("line exchange failed", "err", err)
			_ = c.Error(&middleware.AppError{
				HTTPStatus: http.StatusInternalServerError,
				Key:        "errors.internal",
				Cause:      err,
			})
		}
		return
	}

	c.JSON(http.StatusOK, models.ApiResponse{
		Success: true,
		Data:    lineExchangeResponse{CustomToken: result.CustomToken},
		Message: "auth.line.signed_in",
	})
}

// lineExchanger is the narrow interface the handler depends on; the concrete
// *services.LINEAuthService satisfies it implicitly.
type lineExchanger interface {
	Exchange(ctx context.Context, code, codeVerifier, redirectURI string) (*services.CustomTokenResult, error)
}
