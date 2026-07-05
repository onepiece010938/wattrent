package services

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
)

func TestLINEAuthService_Enabled(t *testing.T) {
	if NewLINEAuthService(nil, "", "").Enabled() {
		t.Error("expected disabled when both creds empty")
	}
	if NewLINEAuthService(nil, "cid", "").Enabled() {
		t.Error("expected disabled when secret empty")
	}
	if NewLINEAuthService(nil, "", "secret").Enabled() {
		t.Error("expected disabled when channel empty")
	}
	if !NewLINEAuthService(nil, "cid", "secret").Enabled() {
		t.Error("expected enabled with both creds set")
	}
}

func TestLINEAuthService_Exchange_Disabled(t *testing.T) {
	svc := NewLINEAuthService(nil, "", "")
	_, err := svc.Exchange(context.Background(), "code", "verifier", "https://example.com")
	if !errors.Is(err, ErrLINEDisabled) {
		t.Errorf("want ErrLINEDisabled, got %v", err)
	}
}

func TestLINEAuthService_Exchange_MissingArgs(t *testing.T) {
	svc := NewLINEAuthService(nil, "cid", "secret")
	cases := []struct{ code, verifier, redirect string }{
		{"", "v", "r"},
		{"c", "", "r"},
		{"c", "v", ""},
	}
	for _, tc := range cases {
		_, err := svc.Exchange(context.Background(), tc.code, tc.verifier, tc.redirect)
		if !errors.Is(err, ErrLINEBadRequest) {
			t.Errorf("case %+v: want ErrLINEBadRequest, got %v", tc, err)
		}
	}
}

func TestLINEAuthService_Exchange_TokenEndpoint4xx(t *testing.T) {
	tokenSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadRequest)
		_, _ = w.Write([]byte(`{"error":"invalid_grant"}`))
	}))
	defer tokenSrv.Close()

	svc := NewLINEAuthService(nil, "cid", "secret", LINEAuthOptions{
		TokenURL:  tokenSrv.URL,
		VerifyURL: "http://invalid.invalid",
	})
	_, err := svc.Exchange(context.Background(), "code", "verifier", "https://example.com")
	if !errors.Is(err, ErrLINEBadRequest) {
		t.Errorf("want ErrLINEBadRequest, got %v", err)
	}
}

func TestLINEAuthService_Exchange_TokenEndpoint5xx(t *testing.T) {
	tokenSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer tokenSrv.Close()

	svc := NewLINEAuthService(nil, "cid", "secret", LINEAuthOptions{
		TokenURL:  tokenSrv.URL,
		VerifyURL: "http://invalid.invalid",
	})
	_, err := svc.Exchange(context.Background(), "code", "verifier", "https://example.com")
	if !errors.Is(err, ErrLINEBadUpstream) {
		t.Errorf("want ErrLINEBadUpstream, got %v", err)
	}
}

func TestLINEAuthService_Exchange_VerifyEndpoint4xx(t *testing.T) {
	tokenSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"id_token":"fake.id.token","access_token":"a","expires_in":2592000}`))
	}))
	defer tokenSrv.Close()
	verifySrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadRequest)
	}))
	defer verifySrv.Close()

	svc := NewLINEAuthService(nil, "cid", "secret", LINEAuthOptions{
		TokenURL:  tokenSrv.URL,
		VerifyURL: verifySrv.URL,
	})
	_, err := svc.Exchange(context.Background(), "code", "verifier", "https://example.com")
	if !errors.Is(err, ErrLINEBadRequest) {
		t.Errorf("want ErrLINEBadRequest, got %v", err)
	}
}

func TestLINEAuthService_Exchange_FormBodyShape(t *testing.T) {
	gotToken := make(chan url.Values, 1)
	tokenSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if err := r.ParseForm(); err != nil {
			t.Errorf("parse form: %v", err)
		}
		gotToken <- r.PostForm
		_, _ = w.Write([]byte(`{"id_token":"fake.id.token"}`))
	}))
	defer tokenSrv.Close()

	verifySrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Return an empty profile to force ErrLINEBadUpstream on sub check.
		_, _ = w.Write([]byte(`{"sub":"","name":"x"}`))
	}))
	defer verifySrv.Close()

	svc := NewLINEAuthService(nil, "cid", "secret", LINEAuthOptions{
		TokenURL:  tokenSrv.URL,
		VerifyURL: verifySrv.URL,
	})
	_, err := svc.Exchange(context.Background(), "the-code", "the-verifier", "https://x.example/redir")
	if !errors.Is(err, ErrLINEBadUpstream) {
		t.Errorf("want ErrLINEBadUpstream (empty sub), got %v", err)
	}

	form := <-gotToken
	if form.Get("code") != "the-code" {
		t.Errorf("code = %q", form.Get("code"))
	}
	if form.Get("code_verifier") != "the-verifier" {
		t.Errorf("code_verifier = %q", form.Get("code_verifier"))
	}
	if form.Get("client_id") != "cid" {
		t.Errorf("client_id = %q", form.Get("client_id"))
	}
	if form.Get("client_secret") != "secret" {
		t.Errorf("client_secret = %q", form.Get("client_secret"))
	}
	if form.Get("grant_type") != "authorization_code" {
		t.Errorf("grant_type = %q", form.Get("grant_type"))
	}
	if !strings.HasPrefix(form.Get("redirect_uri"), "https://x.example/redir") {
		t.Errorf("redirect_uri = %q", form.Get("redirect_uri"))
	}
}

// TestLINEAuthService_Exchange_VerifyEndpoint5xx ensures LINE-side 5xx is
// surfaced as ErrLINEBadUpstream (502 to the client) rather than 400.
func TestLINEAuthService_Exchange_VerifyEndpoint5xx(t *testing.T) {
	tokenSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"id_token":"fake.id.token"}`))
	}))
	defer tokenSrv.Close()
	verifySrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadGateway)
	}))
	defer verifySrv.Close()

	svc := NewLINEAuthService(nil, "cid", "secret", LINEAuthOptions{
		TokenURL:  tokenSrv.URL,
		VerifyURL: verifySrv.URL,
	})
	_, err := svc.Exchange(context.Background(), "code", "verifier", "https://example.com")
	if !errors.Is(err, ErrLINEBadUpstream) {
		t.Errorf("want ErrLINEBadUpstream, got %v", err)
	}
}

// TestLINEAuthService_Exchange_TokenEndpoint_EmptyIDToken catches the case
// where LINE responds 200 OK but with no id_token field. We treat this as
// upstream-bad rather than client-bad: the user's code wasn't necessarily
// wrong, LINE just behaved unexpectedly.
func TestLINEAuthService_Exchange_TokenEndpoint_EmptyIDToken(t *testing.T) {
	tokenSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"access_token":"only-access-no-id"}`))
	}))
	defer tokenSrv.Close()

	svc := NewLINEAuthService(nil, "cid", "secret", LINEAuthOptions{
		TokenURL:  tokenSrv.URL,
		VerifyURL: "http://invalid.invalid",
	})
	_, err := svc.Exchange(context.Background(), "code", "verifier", "https://example.com")
	if !errors.Is(err, ErrLINEBadUpstream) {
		t.Errorf("want ErrLINEBadUpstream, got %v", err)
	}
}

// TestLINEAuthService_Exchange_TokenEndpoint_MalformedJSON guards against a
// LINE endpoint that returns 200 with an unparseable body (this happened in
// the wild during a LINE incident in 2023).
func TestLINEAuthService_Exchange_TokenEndpoint_MalformedJSON(t *testing.T) {
	tokenSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`not-json{[`))
	}))
	defer tokenSrv.Close()

	svc := NewLINEAuthService(nil, "cid", "secret", LINEAuthOptions{
		TokenURL:  tokenSrv.URL,
		VerifyURL: "http://invalid.invalid",
	})
	_, err := svc.Exchange(context.Background(), "code", "verifier", "https://example.com")
	if !errors.Is(err, ErrLINEBadUpstream) {
		t.Errorf("want ErrLINEBadUpstream, got %v", err)
	}
}

// TestLINEAuthService_Exchange_VerifyEndpoint_MalformedJSON mirrors the token
// case for the verify endpoint.
func TestLINEAuthService_Exchange_VerifyEndpoint_MalformedJSON(t *testing.T) {
	tokenSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"id_token":"fake.id.token"}`))
	}))
	defer tokenSrv.Close()
	verifySrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`<html>not json</html>`))
	}))
	defer verifySrv.Close()

	svc := NewLINEAuthService(nil, "cid", "secret", LINEAuthOptions{
		TokenURL:  tokenSrv.URL,
		VerifyURL: verifySrv.URL,
	})
	_, err := svc.Exchange(context.Background(), "code", "verifier", "https://example.com")
	if !errors.Is(err, ErrLINEBadUpstream) {
		t.Errorf("want ErrLINEBadUpstream, got %v", err)
	}
}

// TestLINEAuthService_Exchange_VerifyFormShape verifies the verify endpoint
// receives exactly { id_token, client_id }. Audience binding via client_id is
// what makes LINE confirm the token was minted for OUR channel.
func TestLINEAuthService_Exchange_VerifyFormShape(t *testing.T) {
	tokenSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"id_token":"the-id-token"}`))
	}))
	defer tokenSrv.Close()

	gotVerify := make(chan url.Values, 1)
	verifySrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if err := r.ParseForm(); err != nil {
			t.Errorf("parse form: %v", err)
		}
		gotVerify <- r.PostForm
		// Empty sub forces ErrLINEBadUpstream so we don't need Firebase wired.
		_, _ = w.Write([]byte(`{"sub":"","name":""}`))
	}))
	defer verifySrv.Close()

	svc := NewLINEAuthService(nil, "the-channel-id", "secret", LINEAuthOptions{
		TokenURL:  tokenSrv.URL,
		VerifyURL: verifySrv.URL,
	})
	_, _ = svc.Exchange(context.Background(), "code", "verifier", "https://example.com")

	form := <-gotVerify
	if form.Get("id_token") != "the-id-token" {
		t.Errorf("id_token = %q", form.Get("id_token"))
	}
	if form.Get("client_id") != "the-channel-id" {
		t.Errorf("client_id = %q", form.Get("client_id"))
	}
}
