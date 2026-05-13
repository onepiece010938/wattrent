package services

import (
	"context"
	"fmt"
	"time"

	"cloud.google.com/go/storage"
)

// StorageService 處理電表照片：簽名上傳 / 簽名下載。
//
// 路徑慣例：users/{uid}/bills/{billId}.jpg（不含副檔名延伸；副檔名由 contentType 決定）。
//
// 簽名靠 IAM Credentials API（signBlob）；要求執行身份的 SA 對自己有
// roles/iam.serviceAccountTokenCreator（Terraform 已設定）。
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

// SignedUploadURL 產生 PUT 簽名 URL，前端可直接 PUT 圖片進去。
//
// 限制：
//   - contentType 限定 image/jpeg / image/png / image/webp
//   - 有效時間：15 分鐘
//   - 只允許寫入 users/{uid}/bills/{billId}.{ext}
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

// SignedDownloadURL 從 gs:// 路徑換成可直接 GET 的簽名 URL。
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

// ─────────────── helpers ───────────────

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
