package services

import (
	"context"
	"fmt"
	"io"
	"time"

	"cloud.google.com/go/storage"
)

// StorageService handles meter photos: signed upload / signed download.
//
// Path convention: users/{uid}/bills/{billId}.{ext} (the extension comes from contentType).
//
// Signing relies on the IAM Credentials API (signBlob); the running service
// account must have roles/iam.serviceAccountTokenCreator on itself (Terraform
// already handles this).
type StorageService struct {
	client     *storage.Client
	bucketName string
}

func NewStorageService(client *storage.Client, bucketName string) *StorageService {
	return &StorageService{
		client:     client,
		bucketName: bucketName,
	}
}

// SignedUploadURL produces a PUT signed URL the frontend can PUT the image to directly.
//
// Constraints:
//   - contentType is restricted to image/jpeg / image/png / image/webp
//   - Validity: 15 minutes
//   - Only writes to users/{uid}/bills/{billId}.{ext} are allowed
func (s *StorageService) SignedUploadURL(ctx context.Context, uid, billID, contentType string) (uploadURL, gcsPath string, expiresAt time.Time, err error) {
	ext, ok := imageExt(contentType)
	if !ok {
		return "", "", time.Time{}, fmt.Errorf("unsupported contentType: %s", contentType)
	}

	objectPath := fmt.Sprintf("users/%s/bills/%s.%s", uid, billID, ext)
	expiresAt = time.Now().Add(15 * time.Minute)

	opts := &storage.SignedURLOptions{
		Method:      "PUT",
		Expires:     expiresAt,
		ContentType: contentType,
		Scheme:      storage.SigningSchemeV4,
	}

	url, err := s.client.Bucket(s.bucketName).SignedURL(objectPath, opts)
	if err != nil {
		return "", "", time.Time{}, fmt.Errorf("sign url: %w", err)
	}

	gcsPath = fmt.Sprintf("gs://%s/%s", s.bucketName, objectPath)
	return url, gcsPath, expiresAt, nil
}

// SignedDownloadURL converts a gs:// path into a directly-GETable signed URL.
func (s *StorageService) SignedDownloadURL(ctx context.Context, gcsPath string) (string, time.Time, error) {
	bucket, object, err := parseGCSPath(gcsPath, s.bucketName)
	if err != nil {
		return "", time.Time{}, err
	}

	expiresAt := time.Now().Add(1 * time.Hour)
	url, err := s.client.Bucket(bucket).SignedURL(object, &storage.SignedURLOptions{
		Method:  "GET",
		Expires: expiresAt,
		Scheme:  storage.SigningSchemeV4,
	})
	if err != nil {
		return "", time.Time{}, err
	}
	return url, expiresAt, nil
}

// DownloadObject downloads the bytes of an object from a gs:// path. Used
// mainly so the OCR service can hand the raw image to the Gemini Developer
// API (which cannot read gs:// directly). Also returns the contentType for
// the MIME header.
func (s *StorageService) DownloadObject(ctx context.Context, gcsPath string) (data []byte, contentType string, err error) {
	bucket, object, err := parseGCSPath(gcsPath, s.bucketName)
	if err != nil {
		return nil, "", err
	}

	obj := s.client.Bucket(bucket).Object(object)
	attrs, err := obj.Attrs(ctx)
	if err != nil {
		return nil, "", fmt.Errorf("stat %s: %w", gcsPath, err)
	}
	contentType = attrs.ContentType
	if contentType == "" {
		contentType = "application/octet-stream"
	}

	r, err := obj.NewReader(ctx)
	if err != nil {
		return nil, "", fmt.Errorf("open %s: %w", gcsPath, err)
	}
	defer r.Close()

	data, err = io.ReadAll(r)
	if err != nil {
		return nil, "", fmt.Errorf("read %s: %w", gcsPath, err)
	}
	return data, contentType, nil
}

// --------------- helpers ---------------

func imageExt(contentType string) (string, bool) {
	switch contentType {
	case "image/jpeg", "image/jpg":
		return "jpg", true
	case "image/png":
		return "png", true
	case "image/webp":
		return "webp", true
	default:
		return "", false
	}
}

func parseGCSPath(gcsPath, expectedBucket string) (bucket, object string, err error) {
	const prefix = "gs://"
	if len(gcsPath) <= len(prefix) || gcsPath[:len(prefix)] != prefix {
		return "", "", fmt.Errorf("invalid gcs path: %s", gcsPath)
	}
	rest := gcsPath[len(prefix):]
	for i, c := range rest {
		if c == '/' {
			bucket = rest[:i]
			object = rest[i+1:]
			break
		}
	}
	if bucket == "" || object == "" {
		return "", "", fmt.Errorf("invalid gcs path: %s", gcsPath)
	}
	if expectedBucket != "" && bucket != expectedBucket {
		return "", "", fmt.Errorf("bucket mismatch: got %s, want %s", bucket, expectedBucket)
	}
	return bucket, object, nil
}
