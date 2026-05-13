// Package clients 集中管理對外的 GCP / Firebase 連線。
//
// 設計原則：
//   - 在 main.go 啟動時 Init 一次，傳給 services
//   - 所有 client 都要 graceful close
//   - 認證一律走 Application Default Credentials（local: gcloud auth；
//     Cloud Run: 自動帶 service account；CI: WIF）
package clients

import (
	"context"
	"fmt"
	"log/slog"

	"cloud.google.com/go/firestore"
	"cloud.google.com/go/storage"
	"cloud.google.com/go/vertexai/genai"
	firebase "firebase.google.com/go/v4"
	firebaseauth "firebase.google.com/go/v4/auth"

	"wattrent/internal/config"
)

// Clients 所有外部 client 的集合
type Clients struct {
	Firestore *firestore.Client
	Storage   *storage.Client
	Auth      *firebaseauth.Client
	Vertex    *genai.Client
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

	// ─────── Vertex AI ───────
	c.Vertex, err = genai.NewClient(ctx, cfg.GCPProjectID, cfg.GCPRegion)
	if err != nil {
		return nil, fmt.Errorf("init vertex ai: %w", err)
	}

	slog.Info("all clients initialized")
	return c, nil
}

// Close 關閉所有 client。
// 即使其中一個失敗也會繼續關其他的，最後回第一個遇到的 error。
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
	if c.Vertex != nil {
		if err := c.Vertex.Close(); err != nil && firstErr == nil {
			firstErr = fmt.Errorf("close vertex: %w", err)
		}
	}
	return firstErr
}
