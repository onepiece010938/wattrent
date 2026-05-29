package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

func TestRequestID_GeneratesWhenAbsent(t *testing.T) {
	t.Parallel()
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(RequestID())
	var captured string
	r.GET("/ping", func(c *gin.Context) {
		captured = RequestIDFromContext(c)
		c.String(http.StatusOK, "ok")
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/ping", nil)
	r.ServeHTTP(w, req)

	if captured == "" {
		t.Fatal("expected generated request id, got empty")
	}
	if w.Header().Get(HeaderRequestID) != captured {
		t.Fatalf("response header should mirror context id; got %q vs %q", w.Header().Get(HeaderRequestID), captured)
	}
	if len(captured) != 16 {
		t.Fatalf("expected 16-char hex id, got %d chars: %q", len(captured), captured)
	}
}

func TestRequestID_ReusesClientValue(t *testing.T) {
	t.Parallel()
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(RequestID())
	var captured string
	r.GET("/ping", func(c *gin.Context) {
		captured = RequestIDFromContext(c)
		c.String(http.StatusOK, "ok")
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/ping", nil)
	req.Header.Set(HeaderRequestID, "abc-123-from-client")
	r.ServeHTTP(w, req)

	if captured != "abc-123-from-client" {
		t.Fatalf("expected client id to be preserved, got %q", captured)
	}
}

func TestRequestID_RejectsOverlongClientValue(t *testing.T) {
	t.Parallel()
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(RequestID())
	var captured string
	r.GET("/ping", func(c *gin.Context) {
		captured = RequestIDFromContext(c)
		c.String(http.StatusOK, "ok")
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/ping", nil)
	// 65 chars — above the 64-char cap, so we should generate a fresh id.
	req.Header.Set(HeaderRequestID, "0123456789012345678901234567890123456789012345678901234567890123x")
	r.ServeHTTP(w, req)

	if captured == "0123456789012345678901234567890123456789012345678901234567890123x" {
		t.Fatal("expected overlong client id to be replaced")
	}
	if len(captured) != 16 {
		t.Fatalf("expected freshly generated 16-char id, got %d: %q", len(captured), captured)
	}
}

func TestRequestLogger_DoesNotCrashOnHealth(t *testing.T) {
	t.Parallel()
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(RequestID())
	r.Use(RequestLogger())
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestRateLimit_BurstThenRefuse(t *testing.T) {
	t.Parallel()
	gin.SetMode(gin.TestMode)

	rl := NewRateLimit(0 /* no refill */, 3 /* burst */, time.Minute)

	r := gin.New()
	r.Use(rl.Middleware())
	r.GET("/x", func(c *gin.Context) { c.String(http.StatusOK, "ok") })

	for i := 0; i < 3; i++ {
		w := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/x", nil)
		req.RemoteAddr = "1.1.1.1:1000"
		r.ServeHTTP(w, req)
		if w.Code != http.StatusOK {
			t.Fatalf("call %d: expected 200, got %d", i+1, w.Code)
		}
	}
	// 4th call should be 429
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/x", nil)
	req.RemoteAddr = "1.1.1.1:1000"
	r.ServeHTTP(w, req)
	if w.Code != http.StatusTooManyRequests {
		t.Fatalf("expected 429 after burst, got %d", w.Code)
	}
}

func TestRateLimit_KeyedSeparatelyPerIP(t *testing.T) {
	t.Parallel()
	gin.SetMode(gin.TestMode)
	rl := NewRateLimit(0, 1, time.Minute)

	r := gin.New()
	r.Use(rl.Middleware())
	r.GET("/x", func(c *gin.Context) { c.String(http.StatusOK, "ok") })

	for _, addr := range []string{"1.1.1.1:1", "2.2.2.2:2", "3.3.3.3:3"} {
		w := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/x", nil)
		req.RemoteAddr = addr
		r.ServeHTTP(w, req)
		if w.Code != http.StatusOK {
			t.Fatalf("addr %s: expected 200 (each IP gets its own bucket), got %d", addr, w.Code)
		}
	}
}

func TestRateLimit_KeyedByUIDWhenAuthed(t *testing.T) {
	t.Parallel()
	gin.SetMode(gin.TestMode)
	rl := NewRateLimit(0, 1, time.Minute)

	r := gin.New()
	// Simulate auth middleware setting the uid.
	r.Use(func(c *gin.Context) { c.Set(ContextKeyUID, "user-a"); c.Next() })
	r.Use(rl.Middleware())
	r.GET("/x", func(c *gin.Context) { c.String(http.StatusOK, "ok") })

	// First request from user-a should pass.
	w1 := httptest.NewRecorder()
	r.ServeHTTP(w1, httptest.NewRequest(http.MethodGet, "/x", nil))
	if w1.Code != http.StatusOK {
		t.Fatalf("first call: expected 200, got %d", w1.Code)
	}

	// Second from same uid should fail (burst=1, refill=0).
	w2 := httptest.NewRecorder()
	r.ServeHTTP(w2, httptest.NewRequest(http.MethodGet, "/x", nil))
	if w2.Code != http.StatusTooManyRequests {
		t.Fatalf("second call: expected 429, got %d", w2.Code)
	}
}
