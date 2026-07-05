package handlers

import (
	"context"
	"errors"
	"net/http"
	"testing"

	"wattrent/internal/services"
)

type fakeLineExchanger struct {
	exchangeFn func(ctx context.Context, code, verifier, redirect string) (*services.CustomTokenResult, error)
	calls      int
}

func (f *fakeLineExchanger) Exchange(ctx context.Context, code, verifier, redirect string) (*services.CustomTokenResult, error) {
	f.calls++
	if f.exchangeFn != nil {
		return f.exchangeFn(ctx, code, verifier, redirect)
	}
	return nil, errors.New("not implemented")
}

func TestLINEAuthHandler_Exchange_BadBody(t *testing.T) {
	env := newTestEnv(t)
	// Missing required fields -> handler returns 400.
	rec := env.do(t, "POST", "/api/v1/auth/line/exchange", map[string]any{"code": ""})
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
	if got := decode(t, rec).Error; got != "errors.bad_request" {
		t.Errorf("Error = %q", got)
	}
}

func TestLINEAuthHandler_Exchange_Disabled(t *testing.T) {
	env := newTestEnv(t)
	env.line.exchangeFn = func(ctx context.Context, code, verifier, redirect string) (*services.CustomTokenResult, error) {
		return nil, services.ErrLINEDisabled
	}
	rec := env.do(t, "POST", "/api/v1/auth/line/exchange", map[string]any{
		"code":         "abc",
		"codeVerifier": "ver",
		"redirectUri":  "https://example.com/cb",
	})
	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d", rec.Code)
	}
	if got := decode(t, rec).Error; got != "errors.auth.line_disabled" {
		t.Errorf("Error = %q", got)
	}
}

func TestLINEAuthHandler_Exchange_InvalidCode(t *testing.T) {
	env := newTestEnv(t)
	env.line.exchangeFn = func(ctx context.Context, code, verifier, redirect string) (*services.CustomTokenResult, error) {
		return nil, services.ErrLINEBadRequest
	}
	rec := env.do(t, "POST", "/api/v1/auth/line/exchange", map[string]any{
		"code":         "abc",
		"codeVerifier": "ver",
		"redirectUri":  "https://example.com/cb",
	})
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d", rec.Code)
	}
	if got := decode(t, rec).Error; got != "errors.auth.line_invalid_code" {
		t.Errorf("Error = %q", got)
	}
}

func TestLINEAuthHandler_Exchange_UpstreamError(t *testing.T) {
	env := newTestEnv(t)
	env.line.exchangeFn = func(ctx context.Context, code, verifier, redirect string) (*services.CustomTokenResult, error) {
		return nil, services.ErrLINEBadUpstream
	}
	rec := env.do(t, "POST", "/api/v1/auth/line/exchange", map[string]any{
		"code":         "abc",
		"codeVerifier": "ver",
		"redirectUri":  "https://example.com/cb",
	})
	if rec.Code != http.StatusBadGateway {
		t.Fatalf("status = %d", rec.Code)
	}
	if got := decode(t, rec).Error; got != "errors.auth.line_upstream" {
		t.Errorf("Error = %q", got)
	}
}

func TestLINEAuthHandler_Exchange_OK(t *testing.T) {
	env := newTestEnv(t)
	env.line.exchangeFn = func(ctx context.Context, code, verifier, redirect string) (*services.CustomTokenResult, error) {
		if code != "abc" || verifier != "ver" || redirect != "https://example.com/cb" {
			t.Errorf("unexpected args: code=%s verifier=%s redirect=%s", code, verifier, redirect)
		}
		return &services.CustomTokenResult{CustomToken: "tok123"}, nil
	}
	rec := env.do(t, "POST", "/api/v1/auth/line/exchange", map[string]any{
		"code":         "abc",
		"codeVerifier": "ver",
		"redirectUri":  "https://example.com/cb",
	})
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
	got := decode(t, rec)
	if got.Message != "auth.line.signed_in" {
		t.Errorf("Message = %q", got.Message)
	}
	var data struct {
		CustomToken string `json:"customToken"`
	}
	dataAs(t, got, &data)
	if data.CustomToken != "tok123" {
		t.Errorf("CustomToken = %q", data.CustomToken)
	}
	if env.line.calls != 1 {
		t.Errorf("calls = %d", env.line.calls)
	}
}

// TestLINEAuthHandler_Exchange_FirebaseError covers the default error branch:
// any sentinel we don't explicitly map (e.g. ErrLINEFirebase from a custom
// token mint failure) collapses to 500 with errors.internal so the
// client doesn't leak server internals.
func TestLINEAuthHandler_Exchange_FirebaseError(t *testing.T) {
	env := newTestEnv(t)
	env.line.exchangeFn = func(ctx context.Context, code, verifier, redirect string) (*services.CustomTokenResult, error) {
		return nil, services.ErrLINEFirebase
	}
	rec := env.do(t, "POST", "/api/v1/auth/line/exchange", map[string]any{
		"code":         "abc",
		"codeVerifier": "ver",
		"redirectUri":  "https://example.com/cb",
	})
	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d", rec.Code)
	}
	if got := decode(t, rec).Error; got != "errors.internal" {
		t.Errorf("Error = %q", got)
	}
}

// TestLINEAuthHandler_Exchange_UnknownError mirrors the above with a plain
// non-sentinel error to make sure unknown failure modes also default to 500.
func TestLINEAuthHandler_Exchange_UnknownError(t *testing.T) {
	env := newTestEnv(t)
	env.line.exchangeFn = func(ctx context.Context, code, verifier, redirect string) (*services.CustomTokenResult, error) {
		return nil, errors.New("totally unexpected")
	}
	rec := env.do(t, "POST", "/api/v1/auth/line/exchange", map[string]any{
		"code":         "abc",
		"codeVerifier": "ver",
		"redirectUri":  "https://example.com/cb",
	})
	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d", rec.Code)
	}
	if got := decode(t, rec).Error; got != "errors.internal" {
		t.Errorf("Error = %q", got)
	}
}
