package services

import (
	"errors"
	"sync"
	"time"
	"wattrent/internal/models"
)

// SettingsService 設定服務
type SettingsService struct {
	// 目前使用記憶體儲存，之後會改為 DynamoDB
	store map[string]*models.UserSettings
	mutex sync.RWMutex
}

// NewSettingsService 建立新的設定服務
func NewSettingsService() *SettingsService {
	return &SettingsService{
		store: make(map[string]*models.UserSettings),
		mutex: sync.RWMutex{},
	}
}

// GetSettings 取得用戶設定
func (s *SettingsService) GetSettings(userID string) (*models.UserSettings, error) {
	s.mutex.RLock()
	defer s.mutex.RUnlock()

	settings, exists := s.store[userID]
	if !exists {
		// 如果沒有設定，回傳預設設定
		defaultSettings := &models.UserSettings{
			UserID:                 userID,
			DefaultElectricityRate: 4.5,
			DefaultRent:            8000,
			PreviousMeterReading:   0,
			LandlordName:           "",
			PaymentMethod:          "銀行轉帳",
			UpdatedAt:              time.Now(),
		}
		return defaultSettings, nil
	}

	return settings, nil
}

// SaveSettings 儲存用戶設定
func (s *SettingsService) SaveSettings(settings *models.UserSettings) error {
	if settings.UserID == "" {
		return errors.New("用戶ID不能為空")
	}

	s.mutex.Lock()
	defer s.mutex.Unlock()

	// 更新時間戳
	settings.UpdatedAt = time.Now()

	// 儲存到記憶體
	s.store[settings.UserID] = settings

	return nil
}

// UpdateSettings 更新用戶設定
func (s *SettingsService) UpdateSettings(userID string, updates map[string]interface{}) (*models.UserSettings, error) {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	// 取得現有設定或建立預設設定
	settings, exists := s.store[userID]
	if !exists {
		settings = &models.UserSettings{
			UserID:                 userID,
			DefaultElectricityRate: 4.5,
			DefaultRent:            8000,
			PreviousMeterReading:   0,
			LandlordName:           "",
			PaymentMethod:          "銀行轉帳",
		}
	}

	// 複製一份以避免直接修改
	newSettings := *settings

	// 應用更新
	if rate, ok := updates["defaultElectricityRate"].(float64); ok {
		newSettings.DefaultElectricityRate = rate
	}
	if rent, ok := updates["defaultRent"].(float64); ok {
		newSettings.DefaultRent = rent
	}
	if reading, ok := updates["previousMeterReading"].(float64); ok {
		newSettings.PreviousMeterReading = reading
	}
	if name, ok := updates["landlordName"].(string); ok {
		newSettings.LandlordName = name
	}
	if method, ok := updates["paymentMethod"].(string); ok {
		newSettings.PaymentMethod = method
	}

	// 更新時間戳
	newSettings.UpdatedAt = time.Now()

	// 儲存更新後的設定
	s.store[userID] = &newSettings

	return &newSettings, nil
}

// UpdatePreviousMeterReading 更新前次電表度數
func (s *SettingsService) UpdatePreviousMeterReading(userID string, reading float64) (*models.UserSettings, error) {
	updates := map[string]interface{}{
		"previousMeterReading": reading,
	}
	return s.UpdateSettings(userID, updates)
}

// DeleteSettings 刪除用戶設定
func (s *SettingsService) DeleteSettings(userID string) error {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	delete(s.store, userID)
	return nil
}
