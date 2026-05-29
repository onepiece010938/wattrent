package middleware

import (
	"errors"
	"net/http"
	"testing"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

func TestMapError(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name       string
		err        error
		wantStatus int
		wantKey    string
	}{
		{
			name:       "AppError passes through unchanged",
			err:        &AppError{HTTPStatus: 418, Key: "errors.teapot"},
			wantStatus: 418,
			wantKey:    "errors.teapot",
		},
		{
			name:       "wrapped AppError still matched via errors.As",
			err:        wrap(&AppError{HTTPStatus: 403, Key: "errors.forbidden"}),
			wantStatus: 403,
			wantKey:    "errors.forbidden",
		},
		{
			name:       "grpc NotFound -> ErrNotFound",
			err:        status.Error(codes.NotFound, "missing"),
			wantStatus: http.StatusNotFound,
			wantKey:    ErrNotFound.Key,
		},
		{
			name:       "grpc PermissionDenied -> ErrUnauthorized",
			err:        status.Error(codes.PermissionDenied, "nope"),
			wantStatus: http.StatusUnauthorized,
			wantKey:    ErrUnauthorized.Key,
		},
		{
			name:       "grpc InvalidArgument -> ErrBadRequest",
			err:        status.Error(codes.InvalidArgument, "bad"),
			wantStatus: http.StatusBadRequest,
			wantKey:    ErrBadRequest.Key,
		},
		{
			name:       "grpc Unavailable -> ErrUpstreamFailed",
			err:        status.Error(codes.Unavailable, "down"),
			wantStatus: http.StatusBadGateway,
			wantKey:    ErrUpstreamFailed.Key,
		},
		{
			name:       "anything else -> ErrInternal",
			err:        errors.New("kaboom"),
			wantStatus: http.StatusInternalServerError,
			wantKey:    ErrInternal.Key,
		},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			got := mapError(tc.err)
			if got.HTTPStatus != tc.wantStatus {
				t.Errorf("HTTPStatus = %d, want %d", got.HTTPStatus, tc.wantStatus)
			}
			if got.Key != tc.wantKey {
				t.Errorf("Key = %q, want %q", got.Key, tc.wantKey)
			}
		})
	}
}

func TestAppErrorErrorString(t *testing.T) {
	t.Parallel()

	bare := &AppError{Key: "errors.x"}
	if bare.Error() != "errors.x" {
		t.Errorf("bare = %q, want %q", bare.Error(), "errors.x")
	}

	wrapped := &AppError{Key: "errors.x", Cause: errors.New("boom")}
	if wrapped.Error() != "errors.x: boom" {
		t.Errorf("wrapped = %q, want %q", wrapped.Error(), "errors.x: boom")
	}

	// errors.Unwrap chain works
	if !errors.Is(wrapped, wrapped.Cause) {
		t.Error("expected errors.Is(wrapped, cause) = true")
	}
}

// wrap returns an error that wraps inner so we can check the errors.As path.
func wrap(inner error) error {
	return wrapped{inner}
}

type wrapped struct{ err error }

func (w wrapped) Error() string { return "wrap: " + w.err.Error() }
func (w wrapped) Unwrap() error { return w.err }
