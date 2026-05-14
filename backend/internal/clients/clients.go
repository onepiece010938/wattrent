// Package clients centralises outbound connections to GCP / Firebase / Gemini.
//
// Design principles:
//   - Init once in main.go and inject into services.
//   - Every client has a graceful Close.
//   - GCP authentication uses Application Default Credentials
//     (local: gcloud auth; Cloud Run: built-in service account; CI: WIF).
//   - Gemini authentication depends on AI_BACKEND:
//     "gemini" (default) -> Google AI Studio API key (free tier)
//     "vertex"           -> Vertex AI, sharing the same ADC above
package clients

import (
	"context"
	"fmt"
	"log/slog"

	"cloud.google.com/go/firestore"
	"cloud.google.com/go/storage"
	firebase "firebase.google.com/go/v4"
	firebaseauth "firebase.google.com/go/v4/auth"
	"google.golang.org/genai"

	"wattrent/internal/config"
)

// Clients is the bag of every external client.
type Clients struct {
	Firestore *firestore.Client
	Storage   *storage.Client
	Auth      *firebaseauth.Client
	Gemini    *genai.Client
}

// New builds and initialises every client.
// Any failure returns an error and the caller should fatal out.
func New(ctx context.Context, cfg *config.Config) (*Clients, error) {
	c := &Clients{}

	// ----- Firebase Admin SDK (auth) -----
	app, err := firebase.NewApp(ctx, &firebase.Config{
		ProjectID: cfg.GCPProjectID,
	})
	if err != nil {
		return nil, fmt.Errorf("init firebase app: %w", err)
	}

	c.Auth, err = app.Auth(ctx)
	if err != nil {
		return nil, fmt.Errorf("init firebase auth: %w", err)
	}

	// ----- Firestore -----
	c.Firestore, err = firestore.NewClient(ctx, cfg.GCPProjectID)
	if err != nil {
		return nil, fmt.Errorf("init firestore: %w", err)
	}

	// ----- Cloud Storage -----
	c.Storage, err = storage.NewClient(ctx)
	if err != nil {
		return nil, fmt.Errorf("init storage: %w", err)
	}

	// ----- Gemini (AI Studio or Vertex AI) -----
	// Strategy: fail-late. A missing API key only causes the OCR endpoint to
	// return 503; the whole backend still starts so health checks pass and
	// Sentry can keep alerting on real failures. For production+gemini,
	// config.Load() already fail-fasts higher up.
	geminiCfg, skip, err := buildGeminiConfig(cfg)
	if err != nil {
		return nil, err
	}
	if skip {
		slog.Warn("gemini client not initialized: missing API key (OCR endpoints will fail until GEMINI_API_KEY is set)",
			"aiBackend", cfg.AIBackend, "env", cfg.Env)
	} else {
		c.Gemini, err = genai.NewClient(ctx, geminiCfg)
		if err != nil {
			return nil, fmt.Errorf("init gemini (%s backend): %w", cfg.AIBackend, err)
		}
	}

	slog.Info("all clients initialized", "aiBackend", cfg.AIBackend, "geminiReady", c.Gemini != nil)
	return c, nil
}

// buildGeminiConfig picks between the Gemini Developer API (free tier) and
// Vertex AI (paid) based on configuration.
//
// Returned skip=true means a required setting is missing -> skip initialisation
// so the backend can still come up.
func buildGeminiConfig(cfg *config.Config) (cc *genai.ClientConfig, skip bool, err error) {
	switch cfg.AIBackend {
	case "gemini":
		if cfg.GeminiAPIKey == "" {
			// Production fail-fast is already handled in config.Load.
			// In other environments (staging / dev / preview) we let the
			// backend start anyway; only the OCR endpoint will return 503.
			return nil, true, nil
		}
		return &genai.ClientConfig{
			APIKey:  cfg.GeminiAPIKey,
			Backend: genai.BackendGeminiAPI,
		}, false, nil
	case "vertex":
		return &genai.ClientConfig{
			Project:  cfg.GCPProjectID,
			Location: cfg.GCPRegion,
			Backend:  genai.BackendVertexAI,
		}, false, nil
	default:
		return nil, false, fmt.Errorf("unknown AI_BACKEND: %s", cfg.AIBackend)
	}
}

// Close shuts every client down.
// Even if one fails it keeps closing the rest, then returns the first error.
// Note: the google.golang.org/genai Client has no Close (it is just an HTTP
// client wrapper).
func (c *Clients) Close() error {
	var firstErr error
	if c.Firestore != nil {
		if err := c.Firestore.Close(); err != nil && firstErr == nil {
			firstErr = fmt.Errorf("close firestore: %w", err)
		}
	}
	if c.Storage != nil {
		if err := c.Storage.Close(); err != nil && firstErr == nil {
			firstErr = fmt.Errorf("close storage: %w", err)
		}
	}
	return firstErr
}
