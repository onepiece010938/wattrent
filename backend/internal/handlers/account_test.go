package handlers

import (
	"context"
	"net/http"
	"testing"

	"wattrent/internal/middleware"
)

func TestAccountHandler_DeleteMe_OK(t *testing.T) {
	env := newTestEnv(t)

	rec := env.do(t, http.MethodDelete, "/api/v1/users/me", nil)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
	if env.account.calls != 1 {
		t.Errorf("DeleteAccount calls = %d, want 1", env.account.calls)
	}
	if env.account.lastUID != "test-uid" {
		t.Errorf("uid = %q, want test-uid (from verified token, not body)", env.account.lastUID)
	}
	if got := decode(t, rec); got.Message != "users.account_deleted" || !got.Success {
		t.Errorf("envelope = %+v, want success with users.account_deleted", got)
	}
}

func TestAccountHandler_DeleteMe_ServiceError(t *testing.T) {
	env := newTestEnv(t)
	env.account.deleteFn = func(ctx context.Context, uid string) error {
		return &middleware.AppError{HTTPStatus: http.StatusBadGateway, Key: "errors.account.delete_failed"}
	}

	rec := env.do(t, http.MethodDelete, "/api/v1/users/me", nil)

	if rec.Code != http.StatusBadGateway {
		t.Fatalf("status = %d, want 502", rec.Code)
	}
	if got := decode(t, rec).Error; got != "errors.account.delete_failed" {
		t.Errorf("Error = %q, want errors.account.delete_failed", got)
	}
}

func TestAccountHandler_ClearData_OK(t *testing.T) {
	env := newTestEnv(t)

	rec := env.do(t, http.MethodDelete, "/api/v1/users/me/data", nil)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
	if env.account.clears != 1 {
		t.Errorf("ClearData calls = %d, want 1", env.account.clears)
	}
	if env.account.calls != 0 {
		t.Errorf("DeleteAccount calls = %d, want 0 (clear must not delete the account)", env.account.calls)
	}
	if got := decode(t, rec); got.Message != "users.data_cleared" || !got.Success {
		t.Errorf("envelope = %+v, want success with users.data_cleared", got)
	}
}

func TestAccountHandler_ClearData_ServiceError(t *testing.T) {
	env := newTestEnv(t)
	env.account.clearFn = func(ctx context.Context, uid string) error {
		return &middleware.AppError{HTTPStatus: http.StatusBadGateway, Key: "errors.account.clear_failed"}
	}

	rec := env.do(t, http.MethodDelete, "/api/v1/users/me/data", nil)

	if rec.Code != http.StatusBadGateway {
		t.Fatalf("status = %d, want 502", rec.Code)
	}
	if got := decode(t, rec).Error; got != "errors.account.clear_failed" {
		t.Errorf("Error = %q, want errors.account.clear_failed", got)
	}
}
