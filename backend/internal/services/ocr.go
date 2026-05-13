package services

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"strings"

	"cloud.google.com/go/vertexai/genai"

	"wattrent/internal/middleware"
	"wattrent/internal/models"
)

// OCRService 用 Vertex AI Gemini 讀電表度數。
//
// 為什麼選 Gemini Flash-Lite 而不是傳統 OCR：
//   - 電表的「滾輪在兩個數字之間」場景靠 prompt 指令處理，傳統 OCR 不行
//   - 多種電表型號 / 拍攝角度 / 反光，Gemini 的視覺理解能力優於 cloud OCR
//   - $0.0002 / image，比 Azure Vision Read（$0.0015）便宜
type OCRService struct {
	client *genai.Client
	model  string
}

func NewOCRService(client *genai.Client, model string) *OCRService {
	return &OCRService{client: client, model: model}
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
//   - ImageURL：支援 gs:// 路徑（Vertex AI 直接讀）
//   - ImageBase64：適合前端剛拍照、還沒上傳的場景
func (s *OCRService) Process(ctx context.Context, req *models.OCRRequest) (*models.OCRResponse, error) {
	model := s.client.GenerativeModel(s.model)

	// 強制 JSON 輸出
	model.GenerationConfig.ResponseMIMEType = "application/json"
	temp := float32(0.0) // 度數判讀要 deterministic
	model.GenerationConfig.Temperature = &temp

	parts := []genai.Part{genai.Text(ocrPrompt)}

	switch {
	case req.ImageURL != "":
		mime, err := guessMimeFromURL(req.ImageURL)
		if err != nil {
			return nil, &middleware.AppError{HTTPStatus: 400, Key: "errors.ocr.invalid_image_url", Cause: err}
		}
		parts = append(parts, genai.FileData{
			MIMEType: mime,
			FileURI:  req.ImageURL,
		})
	case req.ImageBase64 != "":
		data, mime, err := decodeBase64Image(req.ImageBase64)
		if err != nil {
			return nil, &middleware.AppError{HTTPStatus: 400, Key: "errors.ocr.invalid_image", Cause: err}
		}
		parts = append(parts, genai.Blob{MIMEType: mime, Data: data})
	default:
		return nil, &middleware.AppError{HTTPStatus: 400, Key: "errors.ocr.image_required"}
	}

	resp, err := model.GenerateContent(ctx, parts...)
	if err != nil {
		return nil, &middleware.AppError{HTTPStatus: 502, Key: "errors.ocr.upstream_failed", Cause: err}
	}

	if len(resp.Candidates) == 0 || len(resp.Candidates[0].Content.Parts) == 0 {
		return nil, &middleware.AppError{HTTPStatus: 502, Key: "errors.ocr.no_response"}
	}

	rawText := ""
	for _, p := range resp.Candidates[0].Content.Parts {
		if t, ok := p.(genai.Text); ok {
			rawText += string(t)
		}
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
