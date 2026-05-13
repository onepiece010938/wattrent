package middleware

import (
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"

	"wattrent/internal/config"
)

// CORS 設定。
//
// production：嚴格白名單（不允許 *）
// 其他環境：若 allowedOrigins 含 "*"，使用 AllowAllOrigins
func CORS(cfg *config.Config) gin.HandlerFunc {
	corsCfg := cors.Config{
		AllowMethods: []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders: []string{
			"Origin",
			"Content-Type",
			"Content-Length",
			"Accept-Encoding",
			"Authorization",
			"X-Requested-With",
		},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * 3600,
	}

	allowAll := false
	for _, o := range cfg.AllowedOrigins {
		if o == "*" {
			allowAll = true
			break
		}
	}

	if allowAll {
		corsCfg.AllowAllOrigins = true
		corsCfg.AllowCredentials = false // wildcard 與 credentials 不能共存
	} else {
		corsCfg.AllowOrigins = cfg.AllowedOrigins
	}

	return cors.New(corsCfg)
}
