package middleware

import (
	"crypto/rand"
	"encoding/hex"
	"log/slog"
	"time"

	"github.com/gin-gonic/gin"
)

// HeaderRequestID is the canonical header carrying a per-request correlation ID.
// Clients may send their own ID; otherwise we generate one. The same value is
// echoed back in the response so frontend logs / Sentry breadcrumbs can be
// correlated with a backend log line.
const HeaderRequestID = "X-Request-ID"

// ContextKeyRequestID is the gin context key used by other middleware / handlers
// to look up the request id (RequestIDFromContext).
const ContextKeyRequestID = "request.id"

// RequestID middleware ensures every request has a stable correlation id.
//   - If the client sent X-Request-ID, reuse it (after a sanity length cap).
//   - Otherwise generate 16 hex chars (8 bytes of CSPRNG entropy).
//
// The id is also written to the response header so the frontend can log it.
func RequestID() gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.GetHeader(HeaderRequestID)
		if len(id) == 0 || len(id) > 64 {
			id = newRequestID()
		}
		c.Set(ContextKeyRequestID, id)
		c.Writer.Header().Set(HeaderRequestID, id)
		c.Next()
	}
}

// RequestIDFromContext returns the correlation id, or empty if Request middleware did not run.
func RequestIDFromContext(c *gin.Context) string {
	return c.GetString(ContextKeyRequestID)
}

func newRequestID() string {
	var b [8]byte
	if _, err := rand.Read(b[:]); err != nil {
		// crypto/rand failure is essentially impossible on supported platforms;
		// fall back to a time-based id so the request still gets a value rather
		// than crashing.
		return hex.EncodeToString([]byte(time.Now().UTC().Format("20060102T150405.000000000")))
	}
	return hex.EncodeToString(b[:])
}

// RequestLogger emits a single structured log line per request, mirroring what
// Cloud Logging expects (method / path / status / latencyMs / uid / requestId).
// It runs AFTER Auth (so uid is populated) but BEFORE the handler returns; we
// install it via gin.Use which means it brackets the rest of the chain.
//
// Health-check pings are noisy and not useful in logs; they are skipped.
func RequestLogger() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		path := c.Request.URL.Path
		// Skip noisy health probes to keep Cloud Logging cheap.
		skip := path == "/health" || path == "/api/v1/health"

		c.Next()

		if skip {
			return
		}

		attrs := []any{
			"method", c.Request.Method,
			"path", path,
			"status", c.Writer.Status(),
			"latencyMs", time.Since(start).Milliseconds(),
			"requestId", RequestIDFromContext(c),
		}
		if uid, ok := c.Get(ContextKeyUID); ok {
			attrs = append(attrs, "uid", uid)
		}
		// Pick severity based on status. We deliberately don't log Auth-errors
		// at Error level because they're expected client-side noise.
		switch {
		case c.Writer.Status() >= 500:
			slog.Error("http request", attrs...)
		case c.Writer.Status() >= 400:
			slog.Warn("http request", attrs...)
		default:
			slog.Info("http request", attrs...)
		}
	}
}
