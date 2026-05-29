package services

import (
	"context"
	"errors"
	"time"

	"cloud.google.com/go/firestore"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"wattrent/internal/middleware"
	"wattrent/internal/models"
)

// UserService manages the /users/{uid} document.
//
// This document is created the first time a user successfully authenticates.
// The frontend calls POST /api/v1/users/me right after Firebase Auth signs the
// user in; the backend either upserts the doc or returns the existing one.
type UserService struct {
	fs *firestore.Client
}

func NewUserService(fs *firestore.Client) *UserService {
	return &UserService{fs: fs}
}

func (s *UserService) ref(uid string) *firestore.DocumentRef {
	return s.fs.Collection("users").Doc(uid)
}

// UpsertProfile is the idempotent first-sign-in handshake.
//   - If the user doc exists: refresh email / displayName / photoUrl,
//     bump updatedAt, return it.
//   - If it doesn't: create with createdAt = now.
//
// Returns the resulting user. The caller (handler) is responsible for resolving
// uid from the verified Firebase Auth token; never trust a uid from the body.
func (s *UserService) UpsertProfile(ctx context.Context, uid, email, displayName, photoURL string) (*models.User, error) {
	if uid == "" {
		return nil, middleware.ErrUnauthorized
	}
	now := time.Now().UTC()
	ref := s.ref(uid)

	var existing *models.User
	snap, err := ref.Get(ctx)
	if err == nil {
		var u models.User
		if err := snap.DataTo(&u); err == nil {
			u.ID = uid
			existing = &u
		}
	} else if status.Code(err) != codes.NotFound {
		return nil, err
	}

	if existing == nil {
		u := models.User{
			Email:       email,
			DisplayName: displayName,
			PhotoURL:    photoURL,
			CreatedAt:   now,
			UpdatedAt:   now,
		}
		if _, err := ref.Set(ctx, u); err != nil {
			return nil, err
		}
		u.ID = uid
		return &u, nil
	}

	// Existing user — write back only the mutable claims.
	updates := []firestore.Update{
		{Path: "updatedAt", Value: now},
	}
	if email != "" && email != existing.Email {
		updates = append(updates, firestore.Update{Path: "email", Value: email})
		existing.Email = email
	}
	if displayName != "" && displayName != existing.DisplayName {
		updates = append(updates, firestore.Update{Path: "displayName", Value: displayName})
		existing.DisplayName = displayName
	}
	if photoURL != "" && photoURL != existing.PhotoURL {
		updates = append(updates, firestore.Update{Path: "photoUrl", Value: photoURL})
		existing.PhotoURL = photoURL
	}
	if _, err := ref.Update(ctx, updates); err != nil {
		return nil, err
	}
	existing.UpdatedAt = now
	return existing, nil
}

// Get returns the user doc, or nil + nil error if it does not exist yet.
func (s *UserService) Get(ctx context.Context, uid string) (*models.User, error) {
	snap, err := s.ref(uid).Get(ctx)
	if err != nil {
		if status.Code(err) == codes.NotFound {
			return nil, nil
		}
		return nil, err
	}
	var u models.User
	if err := snap.DataTo(&u); err != nil {
		return nil, err
	}
	u.ID = uid
	return &u, nil
}

// ErrUserNotFound is returned when Get cannot locate a doc. Currently unused
// at the handler level (Get returns nil instead), kept for callers that prefer
// explicit error handling.
var ErrUserNotFound = errors.New("user not found")
