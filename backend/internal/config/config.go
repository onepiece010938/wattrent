// Package config centralises reading of environment variables.
//
// Nothing else in the codebase should call os.Getenv directly; everything
// must go through this package.
package config

import (
	"fmt"
	"log/slog"
	"os"
	"strings"
)

// Config holds application settings. Every field must have a sensible default
// or be validated inside Load.
type Config struct {
	// Env: staging / production / dev / preview-{n}
	Env string

	// GCPProjectID: shared by Firebase / Firestore / GCS (and Vertex AI when used)
	GCPProjectID string

	// GCPRegion: Firestore / GCS / Vertex AI publisher endpoint, e.g. asia-east1
	GCPRegion string

	// MetersBucket: GCS bucket holding meter photos
	MetersBucket string

	// Port: HTTP listen port (Cloud Run injects PORT; defaults to 8080 locally)
	Port string

	// AllowedOrigins: CORS allowlist; comma-separated, "*" means everything (dev only)
	AllowedOrigins []string

	// AuthBypass: skip ID-token verification during local dev; MUST be false in production
	AuthBypass bool

	// AuthBypassUID: fake uid used when AuthBypass=true
	AuthBypassUID string

	// AIBackend: "gemini" (default, Google AI Studio free tier) or "vertex"
	// (GCP Vertex AI; paid, IAM-based; pick this for high volume or to keep data
	// out of training).
	AIBackend string

	// GeminiAPIKey: required when AIBackend="gemini"; obtain from https://aistudio.google.com/apikey
	GeminiAPIKey string

	// GeminiModel: Gemini model name to use, e.g. gemini-2.5-flash-lite
	GeminiModel string

	// SentryDSN: optional; empty string means Sentry is disabled
	SentryDSN string
}

// Load reads environment variables and returns a Config.
// Returns an error so main can fatal out when a required field is missing.
func Load() (*Config, error) {
	cfg := &Config{
		Env:            envOr("APP_ENV", "dev"),
		GCPProjectID:   os.Getenv("GCP_PROJECT_ID"),
		GCPRegion:      envOr("GCP_REGION", "asia-east1"),
		MetersBucket:   os.Getenv("METERS_BUCKET"),
		Port:           envOr("PORT", "8080"),
		AllowedOrigins: splitAndTrim(envOr("ALLOWED_ORIGINS", "*")),
		AuthBypass:     envOr("AUTH_BYPASS", "false") == "true",
		AuthBypassUID:  envOr("AUTH_BYPASS_UID", "dev-user"),
		AIBackend:      strings.ToLower(envOr("AI_BACKEND", "gemini")),
		GeminiAPIKey:   firstNonEmpty(os.Getenv("GEMINI_API_KEY"), os.Getenv("GOOGLE_API_KEY")),
		GeminiModel:    firstNonEmpty(os.Getenv("GEMINI_MODEL"), os.Getenv("VERTEX_MODEL"), "gemini-2.5-flash-lite"),
		SentryDSN:      os.Getenv("SENTRY_DSN"),
	}

	// AI backend must be either gemini or vertex
	if cfg.AIBackend != "gemini" && cfg.AIBackend != "vertex" {
		return nil, fmt.Errorf("AI_BACKEND must be either gemini or vertex, got: %s", cfg.AIBackend)
	}

	// Hard checks for production
	if cfg.Env == "production" {
		if cfg.AuthBypass {
			return nil, fmt.Errorf("AUTH_BYPASS=true is not allowed in production")
		}
		if contains(cfg.AllowedOrigins, "*") {
			return nil, fmt.Errorf("ALLOWED_ORIGINS=* is not allowed in production")
		}
		if cfg.AIBackend == "gemini" && cfg.GeminiAPIKey == "" {
			return nil, fmt.Errorf("AI_BACKEND=gemini requires GEMINI_API_KEY (apply via Google AI Studio)")
		}
	}

	// Required fields
	if cfg.GCPProjectID == "" && !cfg.AuthBypass {
		return nil, fmt.Errorf("GCP_PROJECT_ID is required (or set AUTH_BYPASS=true for local testing)")
	}

	slog.Info("config loaded",
		"env", cfg.Env,
		"project", cfg.GCPProjectID,
		"region", cfg.GCPRegion,
		"port", cfg.Port,
		"authBypass", cfg.AuthBypass,
		"aiBackend", cfg.AIBackend,
		"geminiModel", cfg.GeminiModel,
	)
	return cfg, nil
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if v != "" {
			return v
		}
	}
	return ""
}

func envOr(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func splitAndTrim(s string) []string {
	parts := strings.Split(s, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if t := strings.TrimSpace(p); t != "" {
			out = append(out, t)
		}
	}
	return out
}

func contains(haystack []string, needle string) bool {
	for _, s := range haystack {
		if s == needle {
			return true
		}
	}
	return false
}
