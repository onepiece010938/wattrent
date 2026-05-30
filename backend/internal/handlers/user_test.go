package handlers

import (
	"context"
	"net/http"
	"testing"
	"time"

	"wattrent/internal/models"
)

func TestUserHandler_GetMe_NotFound(t *testing.T) {
	env := newTestEnv(t)
	// default fakeUserStore.getFn returns nil, nil -> handler maps to 404 + errors.user.not_found
	rec := env.do(t, "GET", "/api/v1/users/me", nil)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, body=%s", rec.Code, rec.Body.String())
	}
	if got := decode(t, rec).Error; got != "errors.user.not_found" {
		t.Errorf("Error = %q", got)
	}
}

func TestUserHandler_GetMe_OK(t *testing.T) {
	env := newTestEnv(t)
	env.users.getFn = func(ctx context.Context, uid string) (*models.User, error) {
		return &models.User{ID: uid, Email: "u@example.com", DisplayName: "Alice", CreatedAt: time.Now(), UpdatedAt: time.Now()}, nil
	}
	rec := env.do(t, "GET", "/api/v1/users/me", nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body=%s", rec.Code, rec.Body.String())
	}
	var u models.User
	dataAs(t, decode(t, rec), &u)
	if u.ID != "test-uid" || u.Email != "u@example.com" {
		t.Errorf("user = %+v", u)
	}
}

func TestUserHandler_UpsertMe_AcceptsEmptyBody(t *testing.T) {
	env := newTestEnv(t)
	called := false
	env.users.upsertFn = func(ctx context.Context, uid, email, displayName, photoURL string) (*models.User, error) {
		called = true
		if uid != "test-uid" {
			t.Errorf("uid = %q", uid)
		}
		// email comes from middleware.GetEmail -> set by AuthBypass to "dev@example.com"
		if email != "dev@example.com" {
			t.Errorf("email = %q", email)
		}
		return &models.User{ID: uid, Email: email}, nil
	}
	rec := env.do(t, "POST", "/api/v1/users/me", nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body=%s", rec.Code, rec.Body.String())
	}
	if !called {
		t.Error("UpsertProfile was not called")
	}
	if got := decode(t, rec).Message; got != "users.bootstrapped" {
		t.Errorf("Message = %q", got)
	}
}

func TestUserHandler_UpsertMe_WithBody(t *testing.T) {
	env := newTestEnv(t)
	env.users.upsertFn = func(ctx context.Context, uid, email, displayName, photoURL string) (*models.User, error) {
		if displayName != "Bob" {
			t.Errorf("displayName = %q", displayName)
		}
		if photoURL != "https://cdn/avatar.png" {
			t.Errorf("photoURL = %q", photoURL)
		}
		return &models.User{ID: uid, Email: email, DisplayName: displayName, PhotoURL: photoURL}, nil
	}
	rec := env.do(t, "POST", "/api/v1/users/me", map[string]any{
		"displayName": "Bob",
		"photoUrl":    "https://cdn/avatar.png",
	})
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
}
