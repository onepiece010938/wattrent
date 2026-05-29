package middleware

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"

	"wattrent/internal/models"
)

// RateLimit is a per-uid (or per-IP, when unauthenticated) sliding-window
// token-bucket limiter. Designed for the abuse case of a single user spamming
// OCR / signed-upload endpoints — NOT for protecting against a distributed
// flood (that's Cloudflare's job).
//
// Implementation notes:
//   - In-memory map; each Cloud Run instance has its own counters. With
//     min_instances=0 / max_instances<=20 this is acceptable for a personal
//     app. For a real multi-tenant deployment use Redis + Memcache.
//   - Map is bounded by janitor cleanup so we don't grow indefinitely.
//   - The limiter is exposed as middleware factories: RateLimitGlobal,
//     RateLimitExpensive — pick whichever fits the route.
type RateLimit struct {
	mu      sync.Mutex
	buckets map[string]*bucket
	rate    float64       // tokens added per second
	burst   float64       // bucket capacity
	ttl     time.Duration // bucket eviction threshold (last-seen)
}

type bucket struct {
	tokens   float64
	lastFill time.Time
	lastSeen time.Time
}

// NewRateLimit creates a limiter with the given refill rate (tokens/sec) and
// burst capacity. Buckets idle for >ttl get garbage-collected by a janitor
// goroutine that runs every ttl/2.
func NewRateLimit(rate, burst float64, ttl time.Duration) *RateLimit {
	rl := &RateLimit{
		buckets: make(map[string]*bucket),
		rate:    rate,
		burst:   burst,
		ttl:     ttl,
	}
	go rl.janitor()
	return rl
}

// Middleware returns a gin handler that consumes 1 token per request from the
// bucket keyed on uid (if Auth ran) or remote IP. When the bucket is empty,
// returns 429 with i18n key errors.rate_limited.
func (rl *RateLimit) Middleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		key := bucketKey(c)
		if !rl.allow(key) {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, models.ApiResponse{
				Success: false,
				Error:   "errors.rate_limited",
			})
			return
		}
		c.Next()
	}
}

func (rl *RateLimit) allow(key string) bool {
	now := time.Now()
	rl.mu.Lock()
	defer rl.mu.Unlock()

	b, ok := rl.buckets[key]
	if !ok {
		// Brand-new bucket starts full so the first request always succeeds.
		rl.buckets[key] = &bucket{tokens: rl.burst - 1, lastFill: now, lastSeen: now}
		return true
	}
	// Refill based on elapsed time since the last refill, capped at burst.
	elapsed := now.Sub(b.lastFill).Seconds()
	b.tokens = minFloat(rl.burst, b.tokens+elapsed*rl.rate)
	b.lastFill = now
	b.lastSeen = now

	if b.tokens < 1 {
		return false
	}
	b.tokens--
	return true
}

func (rl *RateLimit) janitor() {
	ticker := time.NewTicker(rl.ttl / 2)
	defer ticker.Stop()
	for range ticker.C {
		cutoff := time.Now().Add(-rl.ttl)
		rl.mu.Lock()
		for k, b := range rl.buckets {
			if b.lastSeen.Before(cutoff) {
				delete(rl.buckets, k)
			}
		}
		rl.mu.Unlock()
	}
}

func bucketKey(c *gin.Context) string {
	if uid := c.GetString(ContextKeyUID); uid != "" {
		return "uid:" + uid
	}
	return "ip:" + c.ClientIP()
}

func minFloat(a, b float64) float64 {
	if a < b {
		return a
	}
	return b
}
