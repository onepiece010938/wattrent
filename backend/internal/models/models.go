// Package models defines data structures shared between the API and Firestore.
//
// Naming conventions:
//   - Both JSON and Firestore field names use camelCase
//   - Firestore documents do not store userId (it is part of the path)
//   - Document IDs are exposed via Go ID string `firestore:"-"` and never written into the doc data
package models

import "time"

// PaymentMethod is the payment method (frontend i18n key).
type PaymentMethod string

const (
	PaymentMethodBankTransfer PaymentMethod = "bank_transfer"
	PaymentMethodCash         PaymentMethod = "cash"
	PaymentMethodLinePay      PaymentMethod = "line_pay"
	PaymentMethodJkoPay       PaymentMethod = "jko_pay"
	PaymentMethodOther        PaymentMethod = "other"
)

// User is the user document (document ID = Firebase Auth uid).
// Path: /users/{uid}
type User struct {
	ID          string    `firestore:"-"             json:"id"`
	Email       string    `firestore:"email"          json:"email"`
	DisplayName string    `firestore:"displayName"    json:"displayName,omitempty"`
	PhotoURL    string    `firestore:"photoUrl"       json:"photoUrl,omitempty"`
	CreatedAt   time.Time `firestore:"createdAt"      json:"createdAt"`
	UpdatedAt   time.Time `firestore:"updatedAt"      json:"updatedAt"`
}

// UserSettings is the user settings document.
// Path: /users/{uid}/settings/current (the document ID is always "current")
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

// DefaultUserSettings is the default value returned the first time a user reads settings.
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

// OCRResult records an OCR model's reading for a given image (embedded in Bill).
type OCRResult struct {
	Confidence  float64   `firestore:"confidence"   json:"confidence"`
	Model       string    `firestore:"model"         json:"model"`
	RawText     string    `firestore:"rawText"      json:"rawText,omitempty"`
	ProcessedAt time.Time `firestore:"processedAt"  json:"processedAt"`
}

// Bill is a single bill.
// Path: /users/{uid}/bills/{billId}
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

// ------------------ API DTOs ------------------

// CreateBillRequest is the request body for creating a bill.
//
// Notes:
//   - The backend computes usage from settings.PreviousMeterReading; the frontend does not need to send it
//   - period format: YYYY-MM
type CreateBillRequest struct {
	MeterReading    float64 `json:"meterReading"     binding:"required,gte=0"`
	ElectricityRate float64 `json:"electricityRate"  binding:"required,gt=0"`
	Rent            float64 `json:"rent"             binding:"required,gte=0"`
	Period          string  `json:"period"           binding:"required,len=7"` // YYYY-MM
	ImageURL        string  `json:"imageUrl"`
}

// UpdateBillPaymentRequest marks a bill as paid or unpaid.
type UpdateBillPaymentRequest struct {
	Paid bool `json:"paid"`
}

// UpdateSettingsRequest is the body for PATCH /api/v1/settings.
// Every field is an optional pointer; nil means "do not change".
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

// OCRRequest is the OCR request body.
type OCRRequest struct {
	ImageBase64 string `json:"imageBase64"`
	ImageURL    string `json:"imageUrl"`
}

// OCRResponse is the OCR response.
type OCRResponse struct {
	Reading    float64 `json:"reading"`
	Confidence float64 `json:"confidence"`
	RawText    string  `json:"rawText,omitempty"`
	Model      string  `json:"model"`
}

// SignedUploadRequest requests a signed upload URL.
type SignedUploadRequest struct {
	BillID      string `json:"billId" binding:"required"`
	ContentType string `json:"contentType" binding:"required"`
}

// SignedUploadResponse is the signed URL plus the expected GCS path returned to the frontend.
type SignedUploadResponse struct {
	UploadURL string `json:"uploadUrl"`
	GcsPath   string `json:"gcsPath"`
	ExpiresAt string `json:"expiresAt"`
}

// ApiResponse is the unified API response envelope.
//
// Error / Message are i18n keys (e.g. errors.bill_not_found);
// never put localized strings here, the frontend will translate them via t().
type ApiResponse struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Error   string      `json:"error,omitempty"`
	Message string      `json:"message,omitempty"`
}
