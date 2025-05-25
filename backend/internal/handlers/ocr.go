package handlers

import (
	"math/rand"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"wattrent/internal/models"
)

type OCRHandler struct {
	// 之後可以注入 OCR 服務
}

func NewOCRHandler() *OCRHandler {
	return &OCRHandler{}
}

// ProcessImage 處理圖片並識別電表度數
func (h *OCRHandler) ProcessImage(c *gin.Context) {
	var req models.OCRRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.Error(err)
		return
	}

	// TODO: 實作真實的 OCR 處理
	// 可以使用 AWS Textract, Google Cloud Vision API, 或開源的 Tesseract
	
	// 暫時返回模擬結果
	rand.Seed(time.Now().UnixNano())
	mockReading := float64(10000 + rand.Intn(90000)) // 生成 10000-99999 的隨機數
	
	response := models.OCRResponse{
		Reading:    mockReading,
		Confidence: 0.95,
		RawText:    "模擬識別結果",
	}

	c.JSON(http.StatusOK, models.ApiResponse{
		Success: true,
		Data:    response,
		Message: "影像處理成功",
	})
} 