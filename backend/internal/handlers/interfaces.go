package handlers

// This file declares narrow interfaces over the services package, defined here
// (not in services) so that the handlers depend on a minimal contract and can
// be tested with fakes. The concrete *services.* types satisfy these
// implicitly because Go's interfaces are structural.

import (
	"context"
	"time"

	"wattrent/internal/models"
)

type billStore interface {
	Create(ctx context.Context, uid string, req *models.CreateBillRequest) (*models.Bill, error)
	Get(ctx context.Context, uid, billID string) (*models.Bill, error)
	List(ctx context.Context, uid string, limit int) ([]*models.Bill, error)
	Latest(ctx context.Context, uid string) (*models.Bill, error)
	SetPaid(ctx context.Context, uid, billID string, paid bool) (*models.Bill, error)
	Delete(ctx context.Context, uid, billID string) error
}

type settingsStore interface {
	Get(ctx context.Context, uid string) (*models.UserSettings, error)
	Save(ctx context.Context, uid string, settings *models.UserSettings) error
	Patch(ctx context.Context, uid string, req *models.UpdateSettingsRequest) (*models.UserSettings, error)
	Delete(ctx context.Context, uid string) error
}

type ocrRunner interface {
	Process(ctx context.Context, req *models.OCRRequest) (*models.OCRResponse, error)
}

type uploadSigner interface {
	SignedUploadURL(ctx context.Context, uid, billID, contentType string) (uploadURL, gcsPath string, expiresAt time.Time, err error)
}

// downloadSigner is the subset of storage methods the bill handler needs to
// attach short-lived view URLs onto bill detail responses.
type downloadSigner interface {
	SignedDownloadURL(ctx context.Context, gcsPath string) (string, time.Time, error)
}

type userStore interface {
	UpsertProfile(ctx context.Context, uid, email, displayName, photoURL string) (*models.User, error)
	Get(ctx context.Context, uid string) (*models.User, error)
}

// accountManager performs account-wide operations that span multiple stores:
// a full cascading delete (account + all data + login) and a data-only wipe
// (content removed, login kept). Implemented by *services.AccountService.
type accountManager interface {
	DeleteAccount(ctx context.Context, uid string) error
	ClearData(ctx context.Context, uid string) error
}
