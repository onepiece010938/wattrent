package handlers

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"

	"wattrent/internal/config"
	"wattrent/internal/middleware"
)

// TestAuth_RequiredWhenBypassDisabled verifies that when AuthBypass is off and
// the client sends no token, every authed route returns 401 with the right
// i18n key.
func TestAuth_RequiredWhenBypassDisabled(t *testing.T) {
	gin.SetMode(gin.TestMode)
	cfg := &config.Config{Env: "dev", AllowedOrigins: []string{"*"}, AuthBypass: false}
	r := gin.New()
	r.Use(middleware.RequestID(), gin.Recovery(), middleware.CORS(cfg), middleware.ErrorHandler())
	authed := r.Group("/api/v1")
	authed.Use(middleware.Auth(nil, cfg))
	authed.GET("/anything", func(c *gin.Context) { c.JSON(http.StatusOK, gin.H{}) })

	req := httptest.NewRequest("GET", "/api/v1/anything", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, body=%s", rec.Code, rec.Body.String())
	}
	if got := decode(t, rec).Error; got != "errors.auth.missing_token" {
		t.Errorf("Error = %q", got)
	}
}

// TestRequestID_EchoedBack verifies that the X-Request-ID header is reflected
// back in the response and generated server-side when absent.
func TestRequestID_EchoedBack(t *testing.T) {
	env := newTestEnv(t)

	// Case 1: client supplies its own id.
	req := httptest.NewRequest("GET", "/health", nil)
	req.Header.Set(middleware.HeaderRequestID, "client-trace-123")
	rec := httptest.NewRecorder()
	env.router.ServeHTTP(rec, req)
	if got := rec.Header().Get(middleware.HeaderRequestID); got != "client-trace-123" {
		t.Errorf("echoed id = %q, want client-trace-123", got)
	}

	// Case 2: no id supplied -> server generates one.
	req2 := httptest.NewRequest("GET", "/health", nil)
	rec2 := httptest.NewRecorder()
	env.router.ServeHTTP(rec2, req2)
	if got := rec2.Header().Get(middleware.HeaderRequestID); got == "" {
		t.Error("expected generated request id, got empty header")
	}
}

// TestRateLimit_BlocksAfterBurst verifies that the per-uid token bucket starts
// returning 429 once the burst is exhausted.
func TestRateLimit_BlocksAfterBurst(t *testing.T) {
	gin.SetMode(gin.TestMode)
	cfg := &config.Config{Env: "dev", AllowedOrigins: []string{"*"}, AuthBypass: true, AuthBypassUID: "rl-uid"}
	r := gin.New()
	r.Use(middleware.RequestID(), gin.Recovery(), middleware.CORS(cfg), middleware.ErrorHandler())

	rl := middleware.NewRateLimit(0.001, 3, time.Minute) // burst=3, basically no refill
	authed := r.Group("/api/v1")
	authed.Use(middleware.Auth(nil, cfg), rl.Middleware())
	authed.GET("/ping", func(c *gin.Context) { c.JSON(http.StatusOK, gin.H{}) })

	for i := 0; i < 3; i++ {
		req := httptest.NewRequest("GET", "/api/v1/ping", nil)
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("burst[%d] status = %d, want 200", i, rec.Code)
		}
	}
	// 4th request blocked
	req := httptest.NewRequest("GET", "/api/v1/ping", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusTooManyRequests {
		t.Fatalf("4th status = %d, want 429", rec.Code)
	}
	if got := decode(t, rec).Error; got != "errors.rate_limited" {
		t.Errorf("Error = %q", got)
	}
}

// TestHealth_NoAuth verifies the /health route is reachable without a token.
func TestHealth_NoAuth(t *testing.T) {
	env := newTestEnv(t)
	rec := env.do(t, "GET", "/health", nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
}
