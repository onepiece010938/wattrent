package middleware

import (
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"

	"wattrent/internal/config"
)

// CORS configuration.
//
// production: strict allowlist ("*" not allowed).
// other environments: if AllowedOrigins contains "*", use AllowAllOrigins.
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
		corsCfg.AllowCredentials = false // wildcard cannot coexist with credentials
	} else {
		corsCfg.AllowOrigins = cfg.AllowedOrigins
	}

	return cors.New(corsCfg)
}
