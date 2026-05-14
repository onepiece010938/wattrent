// Package middleware provides Gin middlewares: CORS, auth, error handling.
package middleware

import (
	"context"
	"log/slog"
	"net/http"
	"strings"
	"time"

	firebaseauth "firebase.google.com/go/v4/auth"
	"github.com/gin-gonic/gin"

	"wattrent/internal/config"
	"wattrent/internal/models"
)

// ContextKey: gin.Context keys are declared centrally here.
const (
	ContextKeyUID   = "auth.uid"
	ContextKeyEmail = "auth.email"
)

// Auth is the Firebase ID-token verification middleware.
//
// Flow:
//  1. Read Authorization: Bearer <token>.
//  2. Verify the token via the Firebase Admin SDK (signature + expiration).
//  3. Stash uid / email into the gin.Context.
//  4. Handlers read it via GetUID(c).
//
// When AuthBypass=true, verification is skipped and cfg.AuthBypassUID is used.
// LOCAL DEVELOPMENT ONLY.
func Auth(authClient *firebaseauth.Client, cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		if cfg.AuthBypass {
			c.Set(ContextKeyUID, cfg.AuthBypassUID)
			c.Set(ContextKeyEmail, "dev@example.com")
			c.Next()
			return
		}

		header := c.GetHeader("Authorization")
		if !strings.HasPrefix(header, "Bearer ") {
			respondUnauthorized(c, "errors.auth.missing_token")
			return
		}

		idToken := strings.TrimPrefix(header, "Bearer ")
		ctx, cancel := context.WithTimeout(c.Request.Context(), authVerifyTimeout)
		defer cancel()

		token, err := authClient.VerifyIDToken(ctx, idToken)
		if err != nil {
			slog.Warn("verify id token failed", "err", err)
			respondUnauthorized(c, "errors.auth.invalid_token")
			return
		}

		c.Set(ContextKeyUID, token.UID)
		if email, ok := token.Claims["email"].(string); ok {
			c.Set(ContextKeyEmail, email)
		}
		c.Next()
	}
}

// GetUID reads the verified uid out of the gin.Context.
// Must be called after the Auth middleware; it panics if Auth is missing
// (which is a programming bug).
func GetUID(c *gin.Context) string {
	uid := c.GetString(ContextKeyUID)
	if uid == "" {
		// Auth middleware would have aborted, so reaching this point means
		// the router never installed Auth.
		panic("middleware.GetUID called without Auth middleware")
	}
	return uid
}

// GetEmail reads the email out of the gin.Context (may be empty).
func GetEmail(c *gin.Context) string {
	return c.GetString(ContextKeyEmail)
}

func respondUnauthorized(c *gin.Context, errKey string) {
	c.AbortWithStatusJSON(http.StatusUnauthorized, models.ApiResponse{
		Success: false,
		Error:   errKey,
	})
}

const authVerifyTimeout = 5 * time.Second
