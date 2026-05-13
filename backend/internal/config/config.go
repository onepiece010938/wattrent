// Package config 統一從環境變數讀取設定。
//
// 不允許在原始碼任何地方再讀 os.Getenv，全部走這裡。
package config

import (
	"fmt"
	"log/slog"
	"os"
	"strings"
)

// Config 應用程式設定。所有欄位都應有合理預設值或在 Load 時驗證。
type Config struct {
	// Env：staging / production / dev / preview-{n}
	Env string

	// GCPProjectID：Firebase / Firestore / GCS（以及 Vertex AI 後端時）共用
	GCPProjectID string

	// GCPRegion：Firestore / GCS / Vertex AI publisher endpoint，例：asia-east1
	GCPRegion string

	// MetersBucket：電表照片 GCS bucket
	MetersBucket string

	// Port：HTTP 監聽 port（Cloud Run 會帶 PORT；本地預設 8080）
	Port string

	// AllowedOrigins：CORS 白名單；以逗號分隔，"*" 代表全部（僅 dev 用）
	AllowedOrigins []string

	// AuthBypass：本地開發時跳過 ID token 驗證；正式環境必須為 false
	AuthBypass bool

	// AuthBypassUID：AuthBypass=true 時用的假 uid
	AuthBypassUID string

	// AIBackend："gemini"（預設，走 Google AI Studio 免費 tier）或 "vertex"
	//（走 GCP Vertex AI，要錢、走 IAM；高用量 / 不想被拿去訓練資料時切過去）
	AIBackend string

	// GeminiAPIKey：AIBackend="gemini" 時必填；從 https://aistudio.google.com/apikey 拿
	GeminiAPIKey string

	// GeminiModel：要用的 Gemini 模型名，例：gemini-2.5-flash-lite
	GeminiModel string

	// SentryDSN：可選；空字串代表不接 Sentry
	SentryDSN string
}

// Load 讀取環境變數並回傳 Config。
// 若必填欄位缺失，回傳 error 讓 main 直接 fatal。
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

	// AI backend 必須是 gemini 或 vertex
	if cfg.AIBackend != "gemini" && cfg.AIBackend != "vertex" {
		return nil, fmt.Errorf("AI_BACKEND 必須是 gemini 或 vertex，得到：%s", cfg.AIBackend)
	}

	// production 環境的硬性檢查
	if cfg.Env == "production" {
		if cfg.AuthBypass {
			return nil, fmt.Errorf("AUTH_BYPASS=true 不允許在 production 啟用")
		}
		if contains(cfg.AllowedOrigins, "*") {
			return nil, fmt.Errorf("ALLOWED_ORIGINS=* 不允許在 production 啟用")
		}
		if cfg.AIBackend == "gemini" && cfg.GeminiAPIKey == "" {
			return nil, fmt.Errorf("AI_BACKEND=gemini 需要 GEMINI_API_KEY（請從 Google AI Studio 申請）")
		}
	}

	// 必填欄位
	if cfg.GCPProjectID == "" && !cfg.AuthBypass {
		return nil, fmt.Errorf("GCP_PROJECT_ID 必填（或設 AUTH_BYPASS=true 跑本地測試）")
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
