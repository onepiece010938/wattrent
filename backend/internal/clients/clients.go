// Package clients 集中管理對外的 GCP / Firebase / Gemini 連線。
//
// 設計原則：
//   - 在 main.go 啟動時 Init 一次，傳給 services
//   - 所有 client 都要 graceful close
//   - GCP 認證走 Application Default Credentials（local: gcloud auth；
//     Cloud Run: 自動帶 service account；CI: WIF）
//   - Gemini 認證依 AI_BACKEND 切：
//   - "gemini"（預設）走 Google AI Studio API key（免費 tier）
//   - "vertex" 走 Vertex AI 共用上面的 ADC
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

// Clients 所有外部 client 的集合
type Clients struct {
	Firestore *firestore.Client
	Storage   *storage.Client
	Auth      *firebaseauth.Client
	Gemini    *genai.Client
}

// New 建立並初始化所有 client。
// 任一失敗都會回 error，呼叫端應該直接 fatal。
func New(ctx context.Context, cfg *config.Config) (*Clients, error) {
	c := &Clients{}

	// ─────── Firebase Admin SDK（auth） ───────
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

	// ─────── Firestore ───────
	c.Firestore, err = firestore.NewClient(ctx, cfg.GCPProjectID)
	if err != nil {
		return nil, fmt.Errorf("init firestore: %w", err)
	}

	// ─────── Cloud Storage ───────
	c.Storage, err = storage.NewClient(ctx)
	if err != nil {
		return nil, fmt.Errorf("init storage: %w", err)
	}

	// ─────── Gemini（AI Studio 或 Vertex AI） ───────
	// 設計：fail-late。缺 key 只讓 OCR endpoint 回 503，不讓整個 backend 起不來
	//（health check そう Sentry で alerts、生成迫使紬を邊不差りたい）。
	// production+gemini 則 config.Load() 已在更上層 fail-fast。
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

// buildGeminiConfig 依設定選 Gemini Developer API（免費 tier）或 Vertex AI（要錢）。
//
// 回備註：skip=true 表示必要設定不齊 → 該跳過初始化，讓 backend 還能起來。
func buildGeminiConfig(cfg *config.Config) (cc *genai.ClientConfig, skip bool, err error) {
	switch cfg.AIBackend {
	case "gemini":
		if cfg.GeminiAPIKey == "" {
			// production 的 fail-fast 已在 config.Load 處理完。
			// 其他现墔（staging / dev / preview）、適互偷懶、允許 backend 出來，
			// OCR endpoint 才会帶顼 503。
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

// Close 關閉所有 client。
// 即使其中一個失敗也會繼續關其他的，最後回第一個遇到的 error。
// 注： google.golang.org/genai 的 Client 不需要 Close（只是 HTTP client 包裝）。
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
