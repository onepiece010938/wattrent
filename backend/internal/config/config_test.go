package config

import (
	"testing"
)

func TestSplitAndTrim(t *testing.T) {
	t.Parallel()

	tests := []struct {
		input string
		want  []string
	}{
		{input: "", want: []string{}},
		{input: "*", want: []string{"*"}},
		{input: "a,b,c", want: []string{"a", "b", "c"}},
		{input: " a , b , c ", want: []string{"a", "b", "c"}},
		{input: "a,,b", want: []string{"a", "b"}},
		{input: "https://a.com, https://b.com", want: []string{"https://a.com", "https://b.com"}},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.input, func(t *testing.T) {
			t.Parallel()
			got := splitAndTrim(tc.input)
			if len(got) != len(tc.want) {
				t.Fatalf("splitAndTrim(%q) len=%d want %d: got=%v", tc.input, len(got), len(tc.want), got)
			}
			for i := range got {
				if got[i] != tc.want[i] {
					t.Fatalf("splitAndTrim(%q)[%d] = %q want %q", tc.input, i, got[i], tc.want[i])
				}
			}
		})
	}
}

func TestFirstNonEmpty(t *testing.T) {
	t.Parallel()

	if got := firstNonEmpty("", "", "third", "fourth"); got != "third" {
		t.Errorf("got %q, want %q", got, "third")
	}
	if got := firstNonEmpty(); got != "" {
		t.Errorf("got %q, want empty", got)
	}
	if got := firstNonEmpty("first"); got != "first" {
		t.Errorf("got %q, want %q", got, "first")
	}
}

func TestEnvOr(t *testing.T) {
	t.Setenv("WATTRENT_TEST_VAR", "set")
	if got := envOr("WATTRENT_TEST_VAR", "fallback"); got != "set" {
		t.Errorf("got %q, want %q", got, "set")
	}
	if got := envOr("WATTRENT_TEST_VAR_MISSING", "fallback"); got != "fallback" {
		t.Errorf("got %q, want %q", got, "fallback")
	}
}

func TestContains(t *testing.T) {
	if !contains([]string{"a", "b"}, "a") {
		t.Error("expected contains([a,b], a) = true")
	}
	if contains([]string{"a", "b"}, "c") {
		t.Error("expected contains([a,b], c) = false")
	}
	if contains(nil, "a") {
		t.Error("expected contains(nil, a) = false")
	}
}

// TestLoadDevSensible covers the happy path with AUTH_BYPASS=true so we do not
// need real GCP credentials.
func TestLoadDevSensible(t *testing.T) {
	resetEnv(t)
	t.Setenv("APP_ENV", "dev")
	t.Setenv("AUTH_BYPASS", "true")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load failed: %v", err)
	}
	if cfg.Env != "dev" {
		t.Errorf("Env = %q, want dev", cfg.Env)
	}
	if !cfg.AuthBypass {
		t.Error("AuthBypass should be true")
	}
	if cfg.AIBackend != "gemini" {
		t.Errorf("AIBackend = %q, want gemini", cfg.AIBackend)
	}
	if cfg.GeminiModel != "gemini-2.5-flash-lite" {
		t.Errorf("GeminiModel = %q, want default", cfg.GeminiModel)
	}
}

// TestLoadProductionRejectsAuthBypass enforces our hard rule: production
// builds must NOT skip Firebase ID token verification.
func TestLoadProductionRejectsAuthBypass(t *testing.T) {
	resetEnv(t)
	t.Setenv("APP_ENV", "production")
	t.Setenv("AUTH_BYPASS", "true")
	t.Setenv("GCP_PROJECT_ID", "wattrent-prod")
	t.Setenv("METERS_BUCKET", "wattrent-meters-prod")
	t.Setenv("ALLOWED_ORIGINS", "https://example.com")
	t.Setenv("GEMINI_API_KEY", "x")

	if _, err := Load(); err == nil {
		t.Fatal("expected Load to reject AUTH_BYPASS=true in production")
	}
}

func TestLoadProductionRejectsWildcardCORS(t *testing.T) {
	resetEnv(t)
	t.Setenv("APP_ENV", "production")
	t.Setenv("AUTH_BYPASS", "false")
	t.Setenv("GCP_PROJECT_ID", "wattrent-prod")
	t.Setenv("METERS_BUCKET", "wattrent-meters-prod")
	t.Setenv("ALLOWED_ORIGINS", "*")
	t.Setenv("GEMINI_API_KEY", "x")

	if _, err := Load(); err == nil {
		t.Fatal("expected Load to reject ALLOWED_ORIGINS=* in production")
	}
}

func TestLoadProductionRequiresGeminiKey(t *testing.T) {
	resetEnv(t)
	t.Setenv("APP_ENV", "production")
	t.Setenv("AUTH_BYPASS", "false")
	t.Setenv("GCP_PROJECT_ID", "wattrent-prod")
	t.Setenv("METERS_BUCKET", "wattrent-meters-prod")
	t.Setenv("ALLOWED_ORIGINS", "https://example.com")
	t.Setenv("AI_BACKEND", "gemini")
	// no GEMINI_API_KEY
	if _, err := Load(); err == nil {
		t.Fatal("expected Load to require GEMINI_API_KEY when AI_BACKEND=gemini in production")
	}
}

func TestLoadRejectsUnknownAIBackend(t *testing.T) {
	resetEnv(t)
	t.Setenv("AUTH_BYPASS", "true")
	t.Setenv("AI_BACKEND", "bogus")
	if _, err := Load(); err == nil {
		t.Fatal("expected Load to reject AI_BACKEND=bogus")
	}
}

// resetEnv unsets every variable Load consults so each test starts from a
// known state regardless of what the host shell has set.
func resetEnv(t *testing.T) {
	t.Helper()
	vars := []string{
		"APP_ENV", "GCP_PROJECT_ID", "GCP_REGION", "METERS_BUCKET", "PORT",
		"ALLOWED_ORIGINS", "AUTH_BYPASS", "AUTH_BYPASS_UID", "AI_BACKEND",
		"GEMINI_API_KEY", "GOOGLE_API_KEY", "GEMINI_MODEL", "VERTEX_MODEL",
		"SENTRY_DSN",
	}
	for _, v := range vars {
		t.Setenv(v, "")
	}
}
