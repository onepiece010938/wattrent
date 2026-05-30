package handlers

import (
	"context"
	"errors"
	"net/http"
	"testing"
	"time"

	"wattrent/internal/models"
)

func TestUploadHandler_Sign_Success(t *testing.T) {
	env := newTestEnv(t)
	env.uploads.signFn = func(ctx context.Context, uid, billID, contentType string) (string, string, time.Time, error) {
		if uid != "test-uid" {
			t.Errorf("uid = %q", uid)
		}
		return "https://signed.example/upload?token=xyz",
			"gs://meters/" + uid + "/" + billID + ".jpg",
			time.Now().Add(15 * time.Minute), nil
	}
	rec := env.do(t, "POST", "/api/v1/uploads/sign", map[string]any{
		"billId":      "bill-99",
		"contentType": "image/jpeg",
	})
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body=%s", rec.Code, rec.Body.String())
	}
	var out models.SignedUploadResponse
	dataAs(t, decode(t, rec), &out)
	if out.UploadURL == "" || out.GcsPath == "" || out.ExpiresAt == "" {
		t.Errorf("out = %+v", out)
	}
}

func TestUploadHandler_Sign_BadRequest(t *testing.T) {
	env := newTestEnv(t)
	rec := env.do(t, "POST", "/api/v1/uploads/sign", map[string]any{
		"billId": "", // missing contentType + empty billId fails required
	})
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d", rec.Code)
	}
	if got := decode(t, rec).Error; got != "errors.bad_request" {
		t.Errorf("Error = %q", got)
	}
}

func TestUploadHandler_Sign_StorageError(t *testing.T) {
	env := newTestEnv(t)
	env.uploads.signFn = func(ctx context.Context, uid, billID, contentType string) (string, string, time.Time, error) {
		return "", "", time.Time{}, errors.New("gcs unreachable")
	}
	rec := env.do(t, "POST", "/api/v1/uploads/sign", map[string]any{
		"billId":      "bill-99",
		"contentType": "image/jpeg",
	})
	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500", rec.Code)
	}
	if got := decode(t, rec).Error; got != "errors.upload.sign_failed" {
		t.Errorf("Error = %q", got)
	}
}
