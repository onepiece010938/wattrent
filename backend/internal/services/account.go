package services

import (
	"context"
	"errors"
	"fmt"
	"log/slog"

	"cloud.google.com/go/firestore"
	firebaseauth "firebase.google.com/go/v4/auth"
	"google.golang.org/api/iterator"

	"wattrent/internal/middleware"
)

// userObjectDeleter is the narrow slice of StorageService that AccountService
// needs to purge a user's meter photos.
type userObjectDeleter interface {
	DeleteUserObjects(ctx context.Context, uid string) error
}

// AccountService performs a full, irreversible deletion of a user's account and
// every piece of data associated with it:
//   - Cloud Storage: all meter photos under users/{uid}/
//   - Firestore: the users/{uid} document and all sub-collections (bills, settings)
//   - Firebase Auth: the login account itself
//
// This backs DELETE /api/v1/users/me (the in-app "Delete account" button) and
// is what the public data-deletion page linked from the Play Store listing
// promises.
type AccountService struct {
	fs      *firestore.Client
	storage userObjectDeleter
	auth    *firebaseauth.Client
	// deleteAuthUser gates the Firebase Auth deletion. It is false in local
	// AUTH_BYPASS dev mode, where the uid is a synthetic dev user that does not
	// exist in any Firebase project.
	deleteAuthUser bool
}

func NewAccountService(fs *firestore.Client, storage userObjectDeleter, auth *firebaseauth.Client, deleteAuthUser bool) *AccountService {
	return &AccountService{fs: fs, storage: storage, auth: auth, deleteAuthUser: deleteAuthUser}
}

// DeleteAccount removes all data for uid, then the auth login itself.
//
// Ordering rationale: purge the data first (photos + Firestore) so that even if
// the final auth deletion fails, no personal data is left behind — which is the
// outcome the privacy policy guarantees. Every step is idempotent, so a client
// retry after a partial failure converges cleanly.
func (s *AccountService) DeleteAccount(ctx context.Context, uid string) error {
	if uid == "" {
		return middleware.ErrUnauthorized
	}

	// 1. Meter photos in GCS (users/{uid}/...). Surfacing the error lets the
	//    client retry; a retry re-lists and finds nothing to delete.
	if s.storage != nil {
		if err := s.storage.DeleteUserObjects(ctx, uid); err != nil {
			slog.Error("account delete: purge storage failed", "uid", uid, "err", err)
			return &middleware.AppError{HTTPStatus: 502, Key: "errors.account.delete_failed", Cause: err}
		}
	}

	// 2. Firestore: users/{uid} plus every descendant (bills, settings). The Go
	//    SDK has no server-side recursive delete, so we walk sub-collections and
	//    delete leaves first.
	userRef := s.fs.Collection("users").Doc(uid)
	if err := s.deleteDocTree(ctx, userRef); err != nil {
		slog.Error("account delete: firestore delete failed", "uid", uid, "err", err)
		return &middleware.AppError{HTTPStatus: 502, Key: "errors.account.delete_failed", Cause: err}
	}

	// 3. Firebase Auth login. Skipped in AUTH_BYPASS dev mode. A not-found user
	//    is fine (already gone -> idempotent).
	if s.deleteAuthUser && s.auth != nil {
		if err := s.auth.DeleteUser(ctx, uid); err != nil && !firebaseauth.IsUserNotFound(err) {
			slog.Error("account delete: firebase auth delete failed", "uid", uid, "err", err)
			return &middleware.AppError{HTTPStatus: 502, Key: "errors.account.delete_failed", Cause: fmt.Errorf("delete auth user: %w", err)}
		}
	}

	slog.Info("account deleted", "uid", uid)
	return nil
}

// ClearData wipes the user's content — meter photos plus every document in the
// users/{uid} sub-collections (bills, settings) — while keeping the account
// itself (the users/{uid} profile doc and the Firebase Auth login). Backs the
// in-app "Clear all data" button. Idempotent.
func (s *AccountService) ClearData(ctx context.Context, uid string) error {
	if uid == "" {
		return middleware.ErrUnauthorized
	}

	if s.storage != nil {
		if err := s.storage.DeleteUserObjects(ctx, uid); err != nil {
			slog.Error("clear data: purge storage failed", "uid", uid, "err", err)
			return &middleware.AppError{HTTPStatus: 502, Key: "errors.account.clear_failed", Cause: err}
		}
	}

	userRef := s.fs.Collection("users").Doc(uid)
	colls := userRef.Collections(ctx)
	for {
		col, err := colls.Next()
		if errors.Is(err, iterator.Done) {
			break
		}
		if err != nil {
			slog.Error("clear data: list sub-collections failed", "uid", uid, "err", err)
			return &middleware.AppError{HTTPStatus: 502, Key: "errors.account.clear_failed", Cause: err}
		}

		docs := col.DocumentRefs(ctx)
		for {
			child, err := docs.Next()
			if errors.Is(err, iterator.Done) {
				break
			}
			if err != nil {
				slog.Error("clear data: list documents failed", "uid", uid, "err", err)
				return &middleware.AppError{HTTPStatus: 502, Key: "errors.account.clear_failed", Cause: err}
			}
			if err := s.deleteDocTree(ctx, child); err != nil {
				slog.Error("clear data: delete document failed", "uid", uid, "err", err)
				return &middleware.AppError{HTTPStatus: 502, Key: "errors.account.clear_failed", Cause: err}
			}
		}
	}

	slog.Info("account data cleared", "uid", uid)
	return nil
}

// deleteDocTree deletes ref and everything beneath it. It recurses into every
// sub-collection and deletes descendant documents before the document itself.
// Deletion order across siblings does not matter in Firestore, so a simple
// depth-first walk is sufficient for the small per-user tree (bills + settings).
func (s *AccountService) deleteDocTree(ctx context.Context, ref *firestore.DocumentRef) error {
	colls := ref.Collections(ctx)
	for {
		col, err := colls.Next()
		if errors.Is(err, iterator.Done) {
			break
		}
		if err != nil {
			return err
		}

		docs := col.DocumentRefs(ctx)
		for {
			child, err := docs.Next()
			if errors.Is(err, iterator.Done) {
				break
			}
			if err != nil {
				return err
			}
			if err := s.deleteDocTree(ctx, child); err != nil {
				return err
			}
		}
	}

	_, err := ref.Delete(ctx)
	return err
}
