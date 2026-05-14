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

// OCRService reads electricity-meter readings via Gemini (AI Studio or Vertex AI).
//
// Why Gemini Flash-Lite over a traditional OCR service:
//   - The "rotor sitting between two digits" case on mechanical meters is
//     handled by the prompt; classic OCR cannot do it.
//   - Gemini's vision understanding handles many meter models, shooting angles
//     and reflections better than a plain cloud OCR.
//   - The AI Studio free tier offers ~1500 requests/day on Flash-Lite, which
//     is more than enough for a personal project.
//
// Image source handling: regardless of whether the backend is Gemini API or
// Vertex, we always send the image as inline bytes. (1) The Gemini Developer
// API cannot read gs:// directly. (2) It keeps both backend code paths uniform.
type OCRService struct {
	client  *genai.Client
	storage *StorageService
	model   string
}

func NewOCRService(client *genai.Client, storage *StorageService, model string) *OCRService {
	return &OCRService{client: client, storage: storage, model: model}
}

const ocrPrompt = `You are an expert at reading electricity meters. Look at this digital or mechanical electricity-meter photo and return the current cumulative reading (kWh).

Rules:
1. If any mechanical-rotor digit is in motion (sitting between two numbers), always pick the SMALLER digit.
2. Do NOT include the small fractional digits (red or grey-background digits typically denote 0.1 kWh; ignore them).
3. If the image cannot be read (blurry, no meter, occluded), return confidence 0.
4. Return JSON ONLY: no Markdown markers, no explanations.

Response format:
{"reading": <integer kWh>, "confidence": <float 0..1>, "notes": "<short note, may be empty>"}`

type ocrModelOutput struct {
	Reading    float64 `json:"reading"`
	Confidence float64 `json:"confidence"`
	Notes      string  `json:"notes,omitempty"`
}

// Process parses an image and returns an OCRResponse.
//
// Either req.ImageBase64 or req.ImageURL must be set:
//   - ImageURL: supports gs:// paths (downloaded via the Storage service)
//   - ImageBase64: useful for the just-snapped, not-yet-uploaded case
func (s *OCRService) Process(ctx context.Context, req *models.OCRRequest) (*models.OCRResponse, error) {
	// fail-late: if the underlying client was never initialised (e.g. staging
	// has not set GEMINI_API_KEY yet) return 503.
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
			// If GCS did not store a ContentType, fall back to guessing from the URL extension
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
		Temperature:      genai.Ptr(float32(0.0)), // Reading recognition needs to be deterministic
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

// --------------- helpers ---------------

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
