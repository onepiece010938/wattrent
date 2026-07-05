// Package services — LINE Login token-exchange flow.
//
// The frontend runs a PKCE-protected OAuth 2.0 flow against LINE, gets back an
// authorisation code, and posts it here. We exchange the code with LINE for an
// id_token, verify it, mint a Firebase custom token, and hand it back to the
// client. The client then signInWithCustomToken() and from that point on uses
// the normal Firebase ID-token flow against the rest of the API.
//
// References:
//   - https://developers.line.biz/en/docs/line-login/integrate-line-login/
//   - https://developers.line.biz/en/reference/line-login/#issue-access-token
//   - https://developers.line.biz/en/reference/line-login/#verify-id-token
package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"strings"
	"time"

	firebaseauth "firebase.google.com/go/v4/auth"
)

// LINEAuthService exchanges a LINE Login authorization code for a Firebase
// custom token. Built from main.go with the Firebase Auth client + the channel
// credentials. When credentials are empty the service is "disabled" and Enabled()
// returns false — the handler then returns 503.
type LINEAuthService struct {
	auth          *firebaseauth.Client
	channelID     string
	channelSecret string
	tokenURL      string
	verifyURL     string
	httpClient    *http.Client
}

// LINEAuthOptions allows tests to override the LINE API endpoints.
type LINEAuthOptions struct {
	TokenURL   string
	VerifyURL  string
	HTTPClient *http.Client
}

// NewLINEAuthService wires the service. Pass empty channelID / channelSecret
// when LINE login is not configured for this environment; the handler will
// surface a 503 with errors.auth.line_disabled.
func NewLINEAuthService(authClient *firebaseauth.Client, channelID, channelSecret string, opts ...LINEAuthOptions) *LINEAuthService {
	s := &LINEAuthService{
		auth:          authClient,
		channelID:     channelID,
		channelSecret: channelSecret,
		tokenURL:      "https://api.line.me/oauth2/v2.1/token",
		verifyURL:     "https://api.line.me/oauth2/v2.1/verify",
		httpClient:    &http.Client{Timeout: 10 * time.Second},
	}
	if len(opts) > 0 {
		if opts[0].TokenURL != "" {
			s.tokenURL = opts[0].TokenURL
		}
		if opts[0].VerifyURL != "" {
			s.verifyURL = opts[0].VerifyURL
		}
		if opts[0].HTTPClient != nil {
			s.httpClient = opts[0].HTTPClient
		}
	}
	return s
}

// Enabled reports whether the channel credentials are configured. When false
// the handler should return 503 instead of attempting the exchange.
func (s *LINEAuthService) Enabled() bool {
	return s != nil && s.channelID != "" && s.channelSecret != ""
}

// LINEProfile is the subset of LINE's verified id_token claims we care about.
type LINEProfile struct {
	Subject     string // LINE user ID (starts with "U")
	DisplayName string
	PictureURL  string
	Email       string
}

// CustomTokenResult is what the handler returns to the client.
type CustomTokenResult struct {
	CustomToken string      `json:"customToken"`
	Profile     LINEProfile `json:"-"` // not returned to the client; only for logging
}

// Exchange runs the full flow:
//  1. POST to LINE /oauth2/v2.1/token with the PKCE code + verifier
//  2. POST to LINE /oauth2/v2.1/verify to validate the returned id_token
//  3. Upsert (or fetch) a Firebase Auth user keyed on uid = "line:<sub>"
//  4. Mint and return a Firebase custom token
func (s *LINEAuthService) Exchange(ctx context.Context, code, codeVerifier, redirectURI string) (*CustomTokenResult, error) {
	if !s.Enabled() {
		return nil, ErrLINEDisabled
	}
	if code == "" || codeVerifier == "" || redirectURI == "" {
		return nil, ErrLINEBadRequest
	}

	idToken, err := s.requestToken(ctx, code, codeVerifier, redirectURI)
	if err != nil {
		return nil, err
	}

	profile, err := s.verifyIDToken(ctx, idToken)
	if err != nil {
		return nil, err
	}
	if profile.Subject == "" {
		return nil, fmt.Errorf("%w: line returned empty subject", ErrLINEBadUpstream)
	}

	// The Firebase calls below would NPE on a nil client; in production the
	// constructor is always handed cls.Auth. Tests that don't want to set up
	// a real Firebase client should stop the flow at the upstream-error step
	// above (token / verify 4xx), and they do.
	if s.auth == nil {
		return nil, fmt.Errorf("%w: firebase auth client not configured", ErrLINEFirebase)
	}

	uid := "line:" + profile.Subject

	// Upsert the Firebase user record. Best-effort: failure here is fatal
	// because without a Firebase user the custom token would dangle.
	if err := s.ensureFirebaseUser(ctx, uid, profile); err != nil {
		slog.Warn("line: ensure firebase user failed", "uid", uid, "err", err)
		return nil, fmt.Errorf("%w: %v", ErrLINEFirebase, err)
	}

	customToken, err := s.auth.CustomToken(ctx, uid)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrLINEFirebase, err)
	}
	return &CustomTokenResult{CustomToken: customToken, Profile: *profile}, nil
}

// requestToken does step (1): authorization_code -> id_token (with PKCE).
func (s *LINEAuthService) requestToken(ctx context.Context, code, codeVerifier, redirectURI string) (string, error) {
	form := url.Values{}
	form.Set("grant_type", "authorization_code")
	form.Set("code", code)
	form.Set("redirect_uri", redirectURI)
	form.Set("client_id", s.channelID)
	form.Set("client_secret", s.channelSecret)
	form.Set("code_verifier", codeVerifier)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.tokenURL, strings.NewReader(form.Encode()))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("%w: %v", ErrLINEBadUpstream, err)
	}
	defer func() { _ = resp.Body.Close() }()

	body, _ := io.ReadAll(io.LimitReader(resp.Body, 32*1024))
	if resp.StatusCode/100 != 2 {
		// 400 = bad code / verifier mismatch -> map to a 4xx for the client.
		if resp.StatusCode >= 400 && resp.StatusCode < 500 {
			slog.Info("line: token endpoint rejected request", "status", resp.StatusCode, "body", string(body))
			return "", ErrLINEBadRequest
		}
		return "", fmt.Errorf("%w: token endpoint http %d", ErrLINEBadUpstream, resp.StatusCode)
	}

	var tr struct {
		IDToken string `json:"id_token"`
	}
	if err := json.Unmarshal(body, &tr); err != nil {
		return "", fmt.Errorf("%w: parse token response: %v", ErrLINEBadUpstream, err)
	}
	if tr.IDToken == "" {
		return "", fmt.Errorf("%w: missing id_token in token response", ErrLINEBadUpstream)
	}
	return tr.IDToken, nil
}

// verifyIDToken does step (2): asks LINE to verify the id_token AND parses
// the user profile out of the response. We do NOT verify the signature
// locally; LINE's verify endpoint is the documented path.
func (s *LINEAuthService) verifyIDToken(ctx context.Context, idToken string) (*LINEProfile, error) {
	form := url.Values{}
	form.Set("id_token", idToken)
	form.Set("client_id", s.channelID)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.verifyURL, strings.NewReader(form.Encode()))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrLINEBadUpstream, err)
	}
	defer func() { _ = resp.Body.Close() }()

	body, _ := io.ReadAll(io.LimitReader(resp.Body, 32*1024))
	if resp.StatusCode/100 != 2 {
		if resp.StatusCode >= 400 && resp.StatusCode < 500 {
			slog.Info("line: verify endpoint rejected token", "status", resp.StatusCode, "body", string(body))
			return nil, ErrLINEBadRequest
		}
		return nil, fmt.Errorf("%w: verify endpoint http %d", ErrLINEBadUpstream, resp.StatusCode)
	}

	var v struct {
		Sub     string `json:"sub"`
		Name    string `json:"name"`
		Picture string `json:"picture"`
		Email   string `json:"email"`
	}
	if err := json.Unmarshal(body, &v); err != nil {
		return nil, fmt.Errorf("%w: parse verify response: %v", ErrLINEBadUpstream, err)
	}
	return &LINEProfile{
		Subject:     v.Sub,
		DisplayName: v.Name,
		PictureURL:  v.Picture,
		Email:       v.Email,
	}, nil
}

// ensureFirebaseUser either updates an existing /users/{uid} record or creates
// a new one. We only set DisplayName / PhotoURL when LINE actually gave them
// to avoid clobbering an in-app rename.
func (s *LINEAuthService) ensureFirebaseUser(ctx context.Context, uid string, p *LINEProfile) error {
	existing, err := s.auth.GetUser(ctx, uid)
	if err == nil {
		// Already exists. Best-effort refresh of name/photo if LINE has updates.
		update := (&firebaseauth.UserToUpdate{})
		changed := false
		if p.DisplayName != "" && existing.DisplayName != p.DisplayName {
			update = update.DisplayName(p.DisplayName)
			changed = true
		}
		if p.PictureURL != "" && existing.PhotoURL != p.PictureURL {
			update = update.PhotoURL(p.PictureURL)
			changed = true
		}
		if !changed {
			return nil
		}
		_, err := s.auth.UpdateUser(ctx, uid, update)
		return err
	}
	if !firebaseauth.IsUserNotFound(err) {
		return err
	}

	create := (&firebaseauth.UserToCreate{}).UID(uid)
	if p.DisplayName != "" {
		create = create.DisplayName(p.DisplayName)
	}
	if p.PictureURL != "" {
		create = create.PhotoURL(p.PictureURL)
	}
	// LINE only returns email when scope=email AND the user consented. When
	// present we set it on the Firebase user; we deliberately do NOT mark it
	// verified because LINE does not guarantee verification.
	if p.Email != "" {
		create = create.Email(p.Email)
	}
	_, err = s.auth.CreateUser(ctx, create)
	return err
}

// Sentinel errors so the handler can map them to HTTP status + i18n key.
var (
	ErrLINEDisabled    = errors.New("line login disabled")
	ErrLINEBadRequest  = errors.New("line bad request")
	ErrLINEBadUpstream = errors.New("line upstream error")
	ErrLINEFirebase    = errors.New("line firebase error")
)
