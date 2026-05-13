// Package services 包裝 Firestore / Storage / Gemini OCR 操作，
// 處理 model ↔ Firestore document 的轉換與業務規則。
package services

import (
	"context"
	"time"

	"cloud.google.com/go/firestore"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"wattrent/internal/middleware"
	"wattrent/internal/models"
)

// SettingsService 操作 /users/{uid}/settings/current
type SettingsService struct {
	fs *firestore.Client
}

func NewSettingsService(fs *firestore.Client) *SettingsService {
	return &SettingsService{fs: fs}
}

const settingsDocID = "current"

func (s *SettingsService) settingsRef(uid string) *firestore.DocumentRef {
	return s.fs.Collection("users").Doc(uid).Collection("settings").Doc(settingsDocID)
}

// Get 取得使用者設定；不存在時回預設值（不寫入 DB）。
func (s *SettingsService) Get(ctx context.Context, uid string) (*models.UserSettings, error) {
	snap, err := s.settingsRef(uid).Get(ctx)
	if err != nil {
		if status.Code(err) == codes.NotFound {
			d := models.DefaultUserSettings()
			d.UpdatedAt = time.Now().UTC()
			return &d, nil
		}
		return nil, err
	}

	var settings models.UserSettings
	if err := snap.DataTo(&settings); err != nil {
		return nil, err
	}
	return &settings, nil
}

// Save 整份覆寫設定。
func (s *SettingsService) Save(ctx context.Context, uid string, settings *models.UserSettings) error {
	if uid == "" {
		return middleware.ErrUnauthorized
	}
	settings.UpdatedAt = time.Now().UTC()
	_, err := s.settingsRef(uid).Set(ctx, settings)
	return err
}

// Patch 局部更新；nil 欄位不動。
func (s *SettingsService) Patch(ctx context.Context, uid string, req *models.UpdateSettingsRequest) (*models.UserSettings, error) {
	updates := make([]firestore.Update, 0, 8)
	if req.DefaultElectricityRate != nil {
		updates = append(updates, firestore.Update{Path: "defaultElectricityRate", Value: *req.DefaultElectricityRate})
	}
	if req.DefaultRent != nil {
		updates = append(updates, firestore.Update{Path: "defaultRent", Value: *req.DefaultRent})
	}
	if req.PreviousMeterReading != nil {
		updates = append(updates, firestore.Update{Path: "previousMeterReading", Value: *req.PreviousMeterReading})
	}
	if req.LandlordName != nil {
		updates = append(updates, firestore.Update{Path: "landlordName", Value: *req.LandlordName})
	}
	if req.PaymentMethod != nil {
		updates = append(updates, firestore.Update{Path: "paymentMethod", Value: *req.PaymentMethod})
	}
	if req.Language != nil {
		updates = append(updates, firestore.Update{Path: "language", Value: *req.Language})
	}
	if req.NotificationsEnabled != nil {
		updates = append(updates, firestore.Update{Path: "notificationsEnabled", Value: *req.NotificationsEnabled})
	}
	if req.AutoBackup != nil {
		updates = append(updates, firestore.Update{Path: "autoBackup", Value: *req.AutoBackup})
	}

	if len(updates) == 0 {
		return s.Get(ctx, uid)
	}

	updates = append(updates, firestore.Update{Path: "updatedAt", Value: firestore.ServerTimestamp})

	ref := s.settingsRef(uid)
	if _, err := ref.Update(ctx, updates); err != nil {
		// settings 文件不存在時自動建立
		if status.Code(err) == codes.NotFound {
			defaults := models.DefaultUserSettings()
			s.applyPatchToStruct(&defaults, req)
			if err := s.Save(ctx, uid, &defaults); err != nil {
				return nil, err
			}
			return &defaults, nil
		}
		return nil, err
	}
	return s.Get(ctx, uid)
}

func (s *SettingsService) applyPatchToStruct(dst *models.UserSettings, req *models.UpdateSettingsRequest) {
	if req.DefaultElectricityRate != nil {
		dst.DefaultElectricityRate = *req.DefaultElectricityRate
	}
	if req.DefaultRent != nil {
		dst.DefaultRent = *req.DefaultRent
	}
	if req.PreviousMeterReading != nil {
		dst.PreviousMeterReading = *req.PreviousMeterReading
	}
	if req.LandlordName != nil {
		dst.LandlordName = *req.LandlordName
	}
	if req.PaymentMethod != nil {
		dst.PaymentMethod = *req.PaymentMethod
	}
	if req.Language != nil {
		dst.Language = *req.Language
	}
	if req.NotificationsEnabled != nil {
		dst.NotificationsEnabled = *req.NotificationsEnabled
	}
	if req.AutoBackup != nil {
		dst.AutoBackup = *req.AutoBackup
	}
}

// SetPreviousMeterReading 帳單建立後同步更新 settings 內的「上次度數」。
// 通常與建立 bill 包成 transaction。
func (s *SettingsService) SetPreviousMeterReading(ctx context.Context, uid string, reading float64) error {
	_, err := s.settingsRef(uid).Set(ctx, map[string]interface{}{
		"previousMeterReading": reading,
		"updatedAt":            firestore.ServerTimestamp,
	}, firestore.MergeAll)
	return err
}

// Delete 刪除設定（重置為預設值）。
func (s *SettingsService) Delete(ctx context.Context, uid string) error {
	_, err := s.settingsRef(uid).Delete(ctx)
	if err != nil && status.Code(err) != codes.NotFound {
		return err
	}
	return nil
}
