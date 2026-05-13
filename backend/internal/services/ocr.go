package services

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"strings"

	"google.golang.org/genai"

	"wattrent/internal/middleware"
	"wattrent/internal/models"
)

// OCRService 用 Gemini（AI Studio 或 Vertex AI）讀電表度數。
//
// 為什麼選 Gemini Flash-Lite 而不是傳統 OCR：
//   - 電表的「滾輪在兩個數字之間」場景靠 prompt 指令處理，傳統 OCR 不行
//   - 多種電表型號 / 拍攝角度 / 反光，Gemini 的視覺理解能力優於 cloud OCR
//   - AI Studio 免費 tier 對 Flash-Lite 有 1500 次/日 額度，個人專案綜綽有餘
//
// 圖片來源處理：不論後端是 Gemini API 還是 Vertex，一律把圖片以 inline bytes 送
// 出去。這來是因為 Gemini Developer API 不能讀 gs://，二來也讓兩個後端路徑一致。
type OCRService struct {
	client  *genai.Client
	storage *StorageService
	model   string
}

func NewOCRService(client *genai.Client, storage *StorageService, model string) *OCRService {
	return &OCRService{client: client, storage: storage, model: model}
}

const ocrPrompt = `你是電表判讀專家。請看這張電子或機械式電表照片，回傳目前的累計度數（kWh）。

規則：
1. 若機械式滾輪有任何位數正在轉動（介於兩個數字之間），一律取「較小」的那個數字。
2. 不要回小數點後的小字位（紅色或灰色背景的位數通常代表 0.1 度，請忽略）。
3. 若無法辨識（模糊、無電表、被遮蔽），confidence 給 0。
4. 只回 JSON，不要任何 Markdown 標記、不要解釋。

回應格式：
{"reading": <整數度數>, "confidence": <0~1 浮點數>, "notes": "<簡短說明，可空>"}`

type ocrModelOutput struct {
	Reading    float64 `json:"reading"`
	Confidence float64 `json:"confidence"`
	Notes      string  `json:"notes,omitempty"`
}

// Process 解析圖片，回傳 OCRResponse。
//
// req.ImageBase64 與 req.ImageURL 擇一：
//   - ImageURL：支援 gs:// 路徑（會透過 Storage 下載）
//   - ImageBase64：適合前端剛拍照、還沒上傳的場景
func (s *OCRService) Process(ctx context.Context, req *models.OCRRequest) (*models.OCRResponse, error) {
	// fail-late：如果底層 client 沒被初始化（例：staging 還沒填 GEMINI_API_KEY）就回 503。
	if s.client == nil {
		return nil, &middleware.AppError{HTTPStatus: 503, Key: "errors.ocr.not_configured"}
	}

	var (
		imgData []byte
		imgMIME string
	)

	switch {
	case req.ImageURL != "":
		if !strings.HasPrefix(req.ImageURL, "gs://") {
			return nil, &middleware.AppError{HTTPStatus: 400, Key: "errors.ocr.invalid_image_url"}
		}
		data, ct, err := s.storage.DownloadObject(ctx, req.ImageURL)
		if err != nil {
			return nil, &middleware.AppError{HTTPStatus: 502, Key: "errors.ocr.download_failed", Cause: err}
		}
		if ct == "application/octet-stream" {
			// GCS 沒記錄 ContentType 就 fallback 用 URL 副檔名猜
			if guessed, gerr := guessMimeFromURL(req.ImageURL); gerr == nil {
				ct = guessed
			}
		}
		imgData, imgMIME = data, ct
	case req.ImageBase64 != "":
		data, mime, err := decodeBase64Image(req.ImageBase64)
		if err != nil {
			return nil, &middleware.AppError{HTTPStatus: 400, Key: "errors.ocr.invalid_image", Cause: err}
		}
		imgData, imgMIME = data, mime
	default:
		return nil, &middleware.AppError{HTTPStatus: 400, Key: "errors.ocr.image_required"}
	}

	contents := []*genai.Content{{
		Role: "user",
		Parts: []*genai.Part{
			{Text: ocrPrompt},
			{InlineData: &genai.Blob{MIMEType: imgMIME, Data: imgData}},
		},
	}}

	resp, err := s.client.Models.GenerateContent(ctx, s.model, contents, &genai.GenerateContentConfig{
		ResponseMIMEType: "application/json",
		Temperature:      genai.Ptr(float32(0.0)), // 度數判讀要 deterministic
	})
	if err != nil {
		return nil, &middleware.AppError{HTTPStatus: 502, Key: "errors.ocr.upstream_failed", Cause: err}
	}

	rawText := resp.Text()
	if rawText == "" {
		return nil, &middleware.AppError{HTTPStatus: 502, Key: "errors.ocr.no_response"}
	}

	var parsed ocrModelOutput
	if err := json.Unmarshal([]byte(rawText), &parsed); err != nil {
		return nil, &middleware.AppError{
			HTTPStatus: 502,
			Key:        "errors.ocr.invalid_model_output",
			Cause:      fmt.Errorf("parse %q: %w", rawText, err),
		}
	}

	return &models.OCRResponse{
		Reading:    parsed.Reading,
		Confidence: parsed.Confidence,
		RawText:    rawText,
		Model:      s.model,
	}, nil
}

// ─────────────── helpers ───────────────

func decodeBase64Image(s string) (data []byte, mime string, err error) {
	mime = "image/jpeg"

	// data URI: data:image/png;base64,xxx
	if strings.HasPrefix(s, "data:") {
		commaIdx := strings.Index(s, ",")
		if commaIdx < 0 {
			return nil, "", fmt.Errorf("invalid data URI")
		}
		header := s[5:commaIdx]
		s = s[commaIdx+1:]
		if semi := strings.Index(header, ";"); semi > 0 {
			mime = header[:semi]
		} else {
			mime = header
		}
	}

	data, err = base64.StdEncoding.DecodeString(s)
	if err != nil {
		return nil, "", fmt.Errorf("base64 decode: %w", err)
	}
	return data, mime, nil
}

func guessMimeFromURL(url string) (string, error) {
	url = strings.ToLower(url)
	switch {
	case strings.HasSuffix(url, ".jpg"), strings.HasSuffix(url, ".jpeg"):
		return "image/jpeg", nil
	case strings.HasSuffix(url, ".png"):
		return "image/png", nil
	case strings.HasSuffix(url, ".webp"):
		return "image/webp", nil
	default:
		return "", fmt.Errorf("cannot guess MIME from URL: %s", url)
	}
}
