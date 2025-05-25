package middleware

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"wattrent/internal/models"
)

// ErrorHandler 統一錯誤處理
func ErrorHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Next()

		// 檢查是否有錯誤
		if len(c.Errors) > 0 {
			err := c.Errors.Last()
			log.Printf("Error occurred: %v", err)

			// 根據錯誤類型返回不同的狀態碼
			var statusCode int
			var message string

			switch err.Type {
			case gin.ErrorTypeBind:
				statusCode = http.StatusBadRequest
				message = "請求參數錯誤"
			case gin.ErrorTypePublic:
				statusCode = http.StatusBadRequest
				message = err.Error()
			default:
				statusCode = http.StatusInternalServerError
				message = "伺服器內部錯誤"
			}

			c.JSON(statusCode, models.ApiResponse{
				Success: false,
				Error:   err.Error(),
				Message: message,
			})
		}
	}
} 