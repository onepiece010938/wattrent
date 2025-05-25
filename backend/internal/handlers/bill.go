package handlers

import (
	"fmt"
	"net/http"
	"time"

	"wattrent/internal/models"
	"wattrent/internal/services"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type BillHandler struct {
	billService *services.BillService
}

func NewBillHandler(billService *services.BillService) *BillHandler {
	return &BillHandler{
		billService: billService,
	}
}

// CreateBill 建立新帳單
func (h *BillHandler) CreateBill(c *gin.Context) {
	var req models.CreateBillRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.Error(err)
		return
	}

	// TODO: 從認證中獲取用戶 ID
	userID := "user1" // 暫時寫死

	// 查詢上一次的讀數
	lastReading, err := h.billService.GetLastMeterReading(userID)
	var usage float64
	if err == nil && lastReading != nil {
		usage = req.MeterReading - lastReading.Reading
	}

	// 建立電表讀數記錄
	meterReading := &models.MeterReading{
		ID:              uuid.New().String(),
		UserID:          userID,
		Reading:         req.MeterReading,
		ImageURL:        req.ImageURL,
		PreviousReading: 0,
		Usage:           usage,
		CreatedAt:       time.Now(),
	}

	if lastReading != nil {
		meterReading.PreviousReading = lastReading.Reading
	}

	// 儲存電表讀數
	if err := h.billService.SaveMeterReading(meterReading); err != nil {
		c.Error(err)
		return
	}

	// 計算電費
	electricityCost := usage * req.ElectricityRate
	totalAmount := electricityCost + req.Rent

	// 生成付款訊息
	message := fmt.Sprintf("房東您好，本月房租%.0f元加電費%.0f元，總計%.0f元已匯款，請查收。",
		req.Rent, electricityCost, totalAmount)

	// 建立帳單
	bill := &models.Bill{
		ID:               uuid.New().String(),
		UserID:           userID,
		MeterReadingID:   meterReading.ID,
		MeterReading:     req.MeterReading,
		ElectricityUsage: usage,
		ElectricityRate:  req.ElectricityRate,
		ElectricityCost:  electricityCost,
		Rent:             req.Rent,
		TotalAmount:      totalAmount,
		Period:           req.Period,
		Message:          message,
		CreatedAt:        time.Now(),
	}

	// 儲存帳單
	if err := h.billService.SaveBill(bill); err != nil {
		c.Error(err)
		return
	}

	c.JSON(http.StatusOK, models.ApiResponse{
		Success: true,
		Data:    bill,
		Message: "帳單建立成功",
	})
}

// GetBills 獲取帳單列表
func (h *BillHandler) GetBills(c *gin.Context) {
	// TODO: 從認證中獲取用戶 ID
	userID := "user1" // 暫時寫死

	bills, err := h.billService.GetBillsByUserID(userID)
	if err != nil {
		c.Error(err)
		return
	}

	c.JSON(http.StatusOK, models.ApiResponse{
		Success: true,
		Data:    bills,
	})
}

// GetBill 獲取單一帳單
func (h *BillHandler) GetBill(c *gin.Context) {
	billID := c.Param("id")

	bill, err := h.billService.GetBillByID(billID)
	if err != nil {
		c.Error(err)
		return
	}

	c.JSON(http.StatusOK, models.ApiResponse{
		Success: true,
		Data:    bill,
	})
}

// UpdateBillPayment 更新帳單付款狀態
func (h *BillHandler) UpdateBillPayment(c *gin.Context) {
	billID := c.Param("id")

	bill, err := h.billService.GetBillByID(billID)
	if err != nil {
		c.Error(err)
		return
	}

	// 更新付款時間
	now := time.Now()
	bill.PaidAt = &now

	if err := h.billService.UpdateBill(bill); err != nil {
		c.Error(err)
		return
	}

	c.JSON(http.StatusOK, models.ApiResponse{
		Success: true,
		Data:    bill,
		Message: "付款狀態更新成功",
	})
}

// GetLatestBill 獲取最新帳單
func (h *BillHandler) GetLatestBill(c *gin.Context) {
	// TODO: 從認證中獲取用戶 ID
	userID := "user1" // 暫時寫死

	bill, err := h.billService.GetLatestBill(userID)
	if err != nil {
		c.JSON(http.StatusOK, models.ApiResponse{
			Success: true,
			Data:    nil,
			Message: "尚無帳單記錄",
		})
		return
	}

	c.JSON(http.StatusOK, models.ApiResponse{
		Success: true,
		Data:    bill,
	})
}

// DeleteBill 刪除帳單
func (h *BillHandler) DeleteBill(c *gin.Context) {
	billID := c.Param("id")

	if err := h.billService.DeleteBill(billID); err != nil {
		c.Error(err)
		return
	}

	c.JSON(http.StatusOK, models.ApiResponse{
		Success: true,
		Message: "帳單刪除成功",
	})
}

// UpdateBill 更新帳單
func (h *BillHandler) UpdateBill(c *gin.Context) {
	billID := c.Param("id")

	var req map[string]interface{}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.Error(err)
		return
	}

	bill, err := h.billService.GetBillByID(billID)
	if err != nil {
		c.Error(err)
		return
	}

	// 更新付款狀態
	if paidAtStr, ok := req["paidAt"].(string); ok {
		if paidAtStr == "" {
			bill.PaidAt = nil
		} else {
			paidAt, err := time.Parse(time.RFC3339, paidAtStr)
			if err == nil {
				bill.PaidAt = &paidAt
			}
		}
	}

	// 可以在這裡添加其他欄位的更新邏輯

	if err := h.billService.UpdateBill(bill); err != nil {
		c.Error(err)
		return
	}

	c.JSON(http.StatusOK, models.ApiResponse{
		Success: true,
		Data:    bill,
		Message: "帳單更新成功",
	})
}
