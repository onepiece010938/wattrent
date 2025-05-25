package models

import (
	"time"
)

// User 用戶資料
type User struct {
	ID        string    `json:"id" dynamodbav:"id"`
	Email     string    `json:"email" dynamodbav:"email"`
	Name      string    `json:"name" dynamodbav:"name"`
	CreatedAt time.Time `json:"createdAt" dynamodbav:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt" dynamodbav:"updatedAt"`
}

// MeterReading 電表讀數
type MeterReading struct {
	ID              string    `json:"id" dynamodbav:"id"`
	UserID          string    `json:"userId" dynamodbav:"userId"`
	Reading         float64   `json:"reading" dynamodbav:"reading"`
	ImageURL        string    `json:"imageUrl,omitempty" dynamodbav:"imageUrl,omitempty"`
	PreviousReading float64   `json:"previousReading,omitempty" dynamodbav:"previousReading,omitempty"`
	Usage           float64   `json:"usage,omitempty" dynamodbav:"usage,omitempty"`
	CreatedAt       time.Time `json:"createdAt" dynamodbav:"createdAt"`
}

// Bill 帳單
type Bill struct {
	ID               string     `json:"id" dynamodbav:"id"`
	UserID           string     `json:"userId" dynamodbav:"userId"`
	MeterReadingID   string     `json:"meterReadingId" dynamodbav:"meterReadingId"`
	MeterReading     float64    `json:"meterReading" dynamodbav:"meterReading"`
	ElectricityUsage float64    `json:"electricityUsage" dynamodbav:"electricityUsage"`
	ElectricityRate  float64    `json:"electricityRate" dynamodbav:"electricityRate"`
	ElectricityCost  float64    `json:"electricityCost" dynamodbav:"electricityCost"`
	Rent             float64    `json:"rent" dynamodbav:"rent"`
	TotalAmount      float64    `json:"totalAmount" dynamodbav:"totalAmount"`
	Period           string     `json:"period" dynamodbav:"period"`
	Message          string     `json:"message,omitempty" dynamodbav:"message,omitempty"`
	PaidAt           *time.Time `json:"paidAt,omitempty" dynamodbav:"paidAt,omitempty"`
	CreatedAt        time.Time  `json:"createdAt" dynamodbav:"createdAt"`
}

// UserSettings 用戶設定
type UserSettings struct {
	UserID                 string    `json:"userId" dynamodbav:"userId"`
	DefaultElectricityRate float64   `json:"defaultElectricityRate" dynamodbav:"defaultElectricityRate"`
	DefaultRent            float64   `json:"defaultRent" dynamodbav:"defaultRent"`
	LandlordName           string    `json:"landlordName,omitempty" dynamodbav:"landlordName,omitempty"`
	PaymentMethod          string    `json:"paymentMethod,omitempty" dynamodbav:"paymentMethod,omitempty"`
	UpdatedAt              time.Time `json:"updatedAt" dynamodbav:"updatedAt"`
}

// OCRRequest OCR 請求
type OCRRequest struct {
	ImageBase64 string `json:"imageBase64"`
	ImageURL    string `json:"imageUrl"`
}

// OCRResponse OCR 回應
type OCRResponse struct {
	Reading    float64 `json:"reading"`
	Confidence float64 `json:"confidence"`
	RawText    string  `json:"rawText,omitempty"`
}

// CreateBillRequest 建立帳單請求
type CreateBillRequest struct {
	MeterReading    float64 `json:"meterReading" binding:"required"`
	ElectricityRate float64 `json:"electricityRate" binding:"required"`
	Rent            float64 `json:"rent" binding:"required"`
	Period          string  `json:"period" binding:"required"`
	ImageURL        string  `json:"imageUrl,omitempty"`
}

// ApiResponse 統一 API 回應格式
type ApiResponse struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Error   string      `json:"error,omitempty"`
	Message string      `json:"message,omitempty"`
}
