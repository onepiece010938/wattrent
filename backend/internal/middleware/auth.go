// Package middleware 提供 Gin middleware：CORS、auth、error handling。
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

// ContextKey gin.Context 的 key 集中宣告
const (
	ContextKeyUID   = "auth.uid"
	ContextKeyEmail = "auth.email"
)

// Auth Firebase ID token 驗證 middleware。
//
// 流程：
//  1. 讀 Authorization: Bearer <token>
//  2. 用 Firebase Admin SDK 驗 token（自動 verify signature + 過期）
//  3. 把 uid / email 塞進 gin.Context
//  4. handler 用 GetUID(c) 取出
//
// AuthBypass=true 時跳過驗證，使用 cfg.AuthBypassUID。僅供本地開發。
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

// GetUID 從 gin.Context 取出已驗證的 uid。
// 必須在 Auth middleware 之後呼叫；若未驗證會直接 panic（程式 bug）。
func GetUID(c *gin.Context) string {
	uid := c.GetString(ContextKeyUID)
	if uid == "" {
		// Auth middleware 一定會 abort，能走到這裡代表 router 沒掛 Auth
		panic("middleware.GetUID called without Auth middleware")
	}
	return uid
}

// GetEmail 從 gin.Context 取出 email（可能為空）。
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
