// Package models 定義 API 與 Firestore 共用的資料結構。
//
// 命名約定：
//   - JSON / Firestore 欄位都用 camelCase
//   - Firestore 不存 userId（路徑已包含）
//   - 文件 ID 在 Go 層用 ID string `firestore:"-"`，不寫入 doc data
package models

import "time"

// PaymentMethod 付款方式（前端 i18n key）
type PaymentMethod string

const (
	PaymentMethodBankTransfer PaymentMethod = "bank_transfer"
	PaymentMethodCash         PaymentMethod = "cash"
	PaymentMethodLinePay      PaymentMethod = "line_pay"
	PaymentMethodJkoPay       PaymentMethod = "jko_pay"
	PaymentMethodOther        PaymentMethod = "other"
)

// User 使用者主文件（document ID = Firebase Auth uid）。
// 路徑：/users/{uid}
type User struct {
	ID          string    `firestore:"-"             json:"id"`
	Email       string    `firestore:"email"          json:"email"`
	DisplayName string    `firestore:"displayName"    json:"displayName,omitempty"`
	PhotoURL    string    `firestore:"photoUrl"       json:"photoUrl,omitempty"`
	CreatedAt   time.Time `firestore:"createdAt"      json:"createdAt"`
	UpdatedAt   time.Time `firestore:"updatedAt"      json:"updatedAt"`
}

// UserSettings 使用者設定。
// 路徑：/users/{uid}/settings/current （文件 ID 永遠是 "current"）
type UserSettings struct {
	DefaultElectricityRate float64       `firestore:"defaultElectricityRate" json:"defaultElectricityRate"`
	DefaultRent            float64       `firestore:"defaultRent"            json:"defaultRent"`
	PreviousMeterReading   float64       `firestore:"previousMeterReading"   json:"previousMeterReading"`
	LandlordName           string        `firestore:"landlordName"           json:"landlordName,omitempty"`
	PaymentMethod          PaymentMethod `firestore:"paymentMethod"          json:"paymentMethod,omitempty"`
	Language               string        `firestore:"language"               json:"language,omitempty"`
	NotificationsEnabled   bool          `firestore:"notificationsEnabled"   json:"notificationsEnabled"`
	AutoBackup             bool          `firestore:"autoBackup"             json:"autoBackup"`
	UpdatedAt              time.Time     `firestore:"updatedAt"              json:"updatedAt"`
}

// DefaultUserSettings 使用者首次取設定時的預設值。
func DefaultUserSettings() UserSettings {
	return UserSettings{
		DefaultElectricityRate: 4.5,
		DefaultRent:            8000,
		PreviousMeterReading:   0,
		LandlordName:           "",
		PaymentMethod:          PaymentMethodBankTransfer,
		Language:               "",
		NotificationsEnabled:   true,
		AutoBackup:             false,
	}
}

// OCRResult OCR 模型對某張圖片的判讀紀錄（嵌入在 Bill 裡）。
type OCRResult struct {
	Confidence  float64   `firestore:"confidence"   json:"confidence"`
	Model       string    `firestore:"model"         json:"model"`
	RawText     string    `firestore:"rawText"      json:"rawText,omitempty"`
	ProcessedAt time.Time `firestore:"processedAt"  json:"processedAt"`
}

// Bill 單筆帳單。
// 路徑：/users/{uid}/bills/{billId}
type Bill struct {
	ID               string     `firestore:"-"                 json:"id"`
	Period           string     `firestore:"period"             json:"period"`
	PeriodStart      time.Time  `firestore:"periodStart"        json:"periodStart"`
	MeterReading     float64    `firestore:"meterReading"       json:"meterReading"`
	PreviousReading  float64    `firestore:"previousReading"    json:"previousReading"`
	ElectricityUsage float64    `firestore:"electricityUsage"   json:"electricityUsage"`
	ElectricityRate  float64    `firestore:"electricityRate"    json:"electricityRate"`
	ElectricityCost  float64    `firestore:"electricityCost"    json:"electricityCost"`
	Rent             float64    `firestore:"rent"               json:"rent"`
	TotalAmount      float64    `firestore:"totalAmount"        json:"totalAmount"`
	ImageURL         string     `firestore:"imageUrl"           json:"imageUrl,omitempty"`
	PaidAt           *time.Time `firestore:"paidAt,omitempty"  json:"paidAt,omitempty"`
	OCR              *OCRResult `firestore:"ocr,omitempty"      json:"ocr,omitempty"`
	CreatedAt        time.Time  `firestore:"createdAt"          json:"createdAt"`
	UpdatedAt        time.Time  `firestore:"updatedAt"          json:"updatedAt"`
}

// ────────────────── API DTOs ──────────────────

// CreateBillRequest 建立帳單的請求 body。
//
// 注意：
//   - 後端會用 settings.PreviousMeterReading 算 usage，前端不需傳
//   - period 格式：YYYY-MM
type CreateBillRequest struct {
	MeterReading    float64 `json:"meterReading"     binding:"required,gte=0"`
	ElectricityRate float64 `json:"electricityRate"  binding:"required,gt=0"`
	Rent            float64 `json:"rent"             binding:"required,gte=0"`
	Period          string  `json:"period"           binding:"required,len=7"` // YYYY-MM
	ImageURL        string  `json:"imageUrl"`
}

// UpdateBillPaymentRequest 標記 / 取消已付款。
type UpdateBillPaymentRequest struct {
	Paid bool `json:"paid"`
}

// UpdateSettingsRequest PATCH /api/v1/settings 用。
// 全部 optional pointer，nil 代表不改。
type UpdateSettingsRequest struct {
	DefaultElectricityRate *float64       `json:"defaultElectricityRate"`
	DefaultRent            *float64       `json:"defaultRent"`
	PreviousMeterReading   *float64       `json:"previousMeterReading"`
	LandlordName           *string        `json:"landlordName"`
	PaymentMethod          *PaymentMethod `json:"paymentMethod"`
	Language               *string        `json:"language"`
	NotificationsEnabled   *bool          `json:"notificationsEnabled"`
	AutoBackup             *bool          `json:"autoBackup"`
}

// OCRRequest OCR 請求。
type OCRRequest struct {
	ImageBase64 string `json:"imageBase64"`
	ImageURL    string `json:"imageUrl"`
}

// OCRResponse OCR 回應。
type OCRResponse struct {
	Reading    float64 `json:"reading"`
	Confidence float64 `json:"confidence"`
	RawText    string  `json:"rawText,omitempty"`
	Model      string  `json:"model"`
}

// SignedUploadRequest 申請簽名上傳 URL。
type SignedUploadRequest struct {
	BillID      string `json:"billId" binding:"required"`
	ContentType string `json:"contentType" binding:"required"`
}

// SignedUploadResponse 回給前端的簽名 URL + 預期 GCS path。
type SignedUploadResponse struct {
	UploadURL string `json:"uploadUrl"`
	GcsPath   string `json:"gcsPath"`
	ExpiresAt string `json:"expiresAt"`
}

// ApiResponse 統一 API 回應格式。
//
// Error / Message 是 i18n key（例：errors.bill_not_found）；
// 不要塞中文字串，前端會 t() 翻譯。
type ApiResponse struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Error   string      `json:"error,omitempty"`
	Message string      `json:"message,omitempty"`
}
