package handlers

import (
	"context"
	"errors"
	"net/http"
	"testing"

	"wattrent/internal/middleware"
	"wattrent/internal/models"
)

func TestOCRHandler_Process_Success(t *testing.T) {
	env := newTestEnv(t)
	env.ocr.processFn = func(ctx context.Context, req *models.OCRRequest) (*models.OCRResponse, error) {
		if req.ImageBase64 != "data:image/jpeg;base64,abc" && req.ImageURL == "" {
			t.Errorf("req = %+v", req)
		}
		return &models.OCRResponse{Reading: 1543.2, Confidence: 0.87, Model: "gemini-2.5-flash-lite"}, nil
	}
	rec := env.do(t, "POST", "/api/v1/ocr/process", map[string]any{
		"imageBase64": "data:image/jpeg;base64,abc",
	})
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body=%s", rec.Code, rec.Body.String())
	}
	var out models.OCRResponse
	env2 := decode(t, rec)
	dataAs(t, env2, &out)
	if out.Reading != 1543.2 || out.Model != "gemini-2.5-flash-lite" {
		t.Errorf("out = %+v", out)
	}
	if env2.Message != "ocr.processed" {
		t.Errorf("Message = %q", env2.Message)
	}
}

func TestOCRHandler_Process_LowConfidencePropagates(t *testing.T) {
	env := newTestEnv(t)
	env.ocr.processFn = func(ctx context.Context, req *models.OCRRequest) (*models.OCRResponse, error) {
		return nil, &middleware.AppError{HTTPStatus: http.StatusUnprocessableEntity, Key: "errors.ocr.low_confidence"}
	}
	rec := env.do(t, "POST", "/api/v1/ocr/process", map[string]any{
		"imageBase64": "data:image/jpeg;base64,abc",
	})
	if rec.Code != http.StatusUnprocessableEntity {
		t.Fatalf("status = %d, want 422", rec.Code)
	}
	if got := decode(t, rec).Error; got != "errors.ocr.low_confidence" {
		t.Errorf("Error = %q", got)
	}
}

func TestOCRHandler_Process_UpstreamFailureMapsTo502(t *testing.T) {
	env := newTestEnv(t)
	env.ocr.processFn = func(ctx context.Context, req *models.OCRRequest) (*models.OCRResponse, error) {
		return nil, errors.New("gemini connection refused")
	}
	rec := env.do(t, "POST", "/api/v1/ocr/process", map[string]any{
		"imageBase64": "data:image/jpeg;base64,abc",
	})
	// A naked error (not AppError, not gRPC) becomes 500 errors.internal.
	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500", rec.Code)
	}
	if got := decode(t, rec).Error; got != "errors.internal" {
		t.Errorf("Error = %q", got)
	}
}
