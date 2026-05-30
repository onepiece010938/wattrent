package handlers

import (
	"context"
	"net/http"
	"testing"

	"wattrent/internal/models"
)

func TestSettingsHandler_Get(t *testing.T) {
	env := newTestEnv(t)
	env.settings.getFn = func(ctx context.Context, uid string) (*models.UserSettings, error) {
		return &models.UserSettings{DefaultElectricityRate: 5.5, DefaultRent: 9000}, nil
	}
	rec := env.do(t, "GET", "/api/v1/settings", nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body=%s", rec.Code, rec.Body.String())
	}
	var s models.UserSettings
	dataAs(t, decode(t, rec), &s)
	if s.DefaultElectricityRate != 5.5 || s.DefaultRent != 9000 {
		t.Errorf("settings = %+v", s)
	}
}

func TestSettingsHandler_Save(t *testing.T) {
	env := newTestEnv(t)
	saved := false
	env.settings.saveFn = func(ctx context.Context, uid string, s *models.UserSettings) error {
		saved = true
		if s.DefaultElectricityRate != 6.0 {
			t.Errorf("rate = %v", s.DefaultElectricityRate)
		}
		return nil
	}
	rec := env.do(t, "PUT", "/api/v1/settings", map[string]any{
		"defaultElectricityRate": 6.0,
		"defaultRent":            10000,
		"notificationsEnabled":   true,
		"autoBackup":             false,
	})
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
	if !saved {
		t.Error("Save was not called")
	}
	if got := decode(t, rec).Message; got != "settings.saved" {
		t.Errorf("Message = %q", got)
	}
}

func TestSettingsHandler_Patch(t *testing.T) {
	env := newTestEnv(t)
	env.settings.patchFn = func(ctx context.Context, uid string, req *models.UpdateSettingsRequest) (*models.UserSettings, error) {
		if req.DefaultRent == nil || *req.DefaultRent != 12000 {
			t.Errorf("req.DefaultRent = %v", req.DefaultRent)
		}
		return &models.UserSettings{DefaultRent: 12000}, nil
	}
	rec := env.do(t, "PATCH", "/api/v1/settings", map[string]any{"defaultRent": 12000})
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body=%s", rec.Code, rec.Body.String())
	}
	if got := decode(t, rec).Message; got != "settings.updated" {
		t.Errorf("Message = %q", got)
	}
}

func TestSettingsHandler_Delete(t *testing.T) {
	env := newTestEnv(t)
	called := false
	env.settings.deleteFn = func(ctx context.Context, uid string) error {
		called = true
		return nil
	}
	rec := env.do(t, "DELETE", "/api/v1/settings", nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
	if !called {
		t.Error("Delete was not called")
	}
	if got := decode(t, rec).Message; got != "settings.deleted" {
		t.Errorf("Message = %q", got)
	}
}
