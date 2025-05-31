package handlers

import (
	"net/http"
	"wattrent/internal/models"
	"wattrent/internal/services"

	"github.com/gin-gonic/gin"
)

// SettingsHandler 設定處理器
type SettingsHandler struct {
	settingsService *services.SettingsService
}

// NewSettingsHandler 建立新的設定處理器
func NewSettingsHandler(settingsService *services.SettingsService) *SettingsHandler {
	return &SettingsHandler{
		settingsService: settingsService,
	}
}

// GetSettings 取得用戶設定
// GET /api/v1/settings?userId=user1
func (h *SettingsHandler) GetSettings(c *gin.Context) {
	userID := c.Query("userId")
	if userID == "" {
		c.JSON(http.StatusBadRequest, models.ApiResponse{
			Success: false,
			Error:   "用戶ID不能為空",
		})
		return
	}

	settings, err := h.settingsService.GetSettings(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ApiResponse{
			Success: false,
			Error:   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, models.ApiResponse{
		Success: true,
		Data:    settings,
	})
}

// SaveSettings 儲存用戶設定
// POST /api/v1/settings
func (h *SettingsHandler) SaveSettings(c *gin.Context) {
	var settings models.UserSettings
	if err := c.ShouldBindJSON(&settings); err != nil {
		c.JSON(http.StatusBadRequest, models.ApiResponse{
			Success: false,
			Error:   "無效的請求資料: " + err.Error(),
		})
		return
	}

	// 驗證必要欄位
	if settings.UserID == "" {
		c.JSON(http.StatusBadRequest, models.ApiResponse{
			Success: false,
			Error:   "用戶ID不能為空",
		})
		return
	}

	err := h.settingsService.SaveSettings(&settings)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ApiResponse{
			Success: false,
			Error:   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, models.ApiResponse{
		Success: true,
		Data:    settings,
		Message: "設定儲存成功",
	})
}

// UpdateSettings 更新用戶設定
// PATCH /api/v1/settings/:userId
func (h *SettingsHandler) UpdateSettings(c *gin.Context) {
	userID := c.Param("userId")
	if userID == "" {
		c.JSON(http.StatusBadRequest, models.ApiResponse{
			Success: false,
			Error:   "用戶ID不能為空",
		})
		return
	}

	var updates map[string]interface{}
	if err := c.ShouldBindJSON(&updates); err != nil {
		c.JSON(http.StatusBadRequest, models.ApiResponse{
			Success: false,
			Error:   "無效的請求資料: " + err.Error(),
		})
		return
	}

	settings, err := h.settingsService.UpdateSettings(userID, updates)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ApiResponse{
			Success: false,
			Error:   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, models.ApiResponse{
		Success: true,
		Data:    settings,
		Message: "設定更新成功",
	})
}

// DeleteSettings 刪除用戶設定
// DELETE /api/v1/settings/:userId
func (h *SettingsHandler) DeleteSettings(c *gin.Context) {
	userID := c.Param("userId")
	if userID == "" {
		c.JSON(http.StatusBadRequest, models.ApiResponse{
			Success: false,
			Error:   "用戶ID不能為空",
		})
		return
	}

	err := h.settingsService.DeleteSettings(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ApiResponse{
			Success: false,
			Error:   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, models.ApiResponse{
		Success: true,
		Message: "設定刪除成功",
	})
}

// UpdatePreviousMeterReading 更新前次電表度數
// PATCH /api/v1/settings/:userId/meter-reading
func (h *SettingsHandler) UpdatePreviousMeterReading(c *gin.Context) {
	userID := c.Param("userId")
	if userID == "" {
		c.JSON(http.StatusBadRequest, models.ApiResponse{
			Success: false,
			Error:   "用戶ID不能為空",
		})
		return
	}

	var request struct {
		Reading float64 `json:"reading" binding:"required"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, models.ApiResponse{
			Success: false,
			Error:   "無效的請求資料: " + err.Error(),
		})
		return
	}

	settings, err := h.settingsService.UpdatePreviousMeterReading(userID, request.Reading)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ApiResponse{
			Success: false,
			Error:   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, models.ApiResponse{
		Success: true,
		Data:    settings,
		Message: "前次電表度數更新成功",
	})
}
