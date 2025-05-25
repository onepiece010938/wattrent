package main

import (
	"log"

	"wattrent/internal/handlers"
	"wattrent/internal/middleware"
	"wattrent/internal/services"

	"github.com/gin-gonic/gin"
)

func main() {
	// 初始化 Gin
	r := gin.Default()

	// 加入中間件
	r.Use(middleware.CORS())
	r.Use(middleware.ErrorHandler())

	// 初始化服務
	billService := services.NewBillService()

	// 初始化處理器
	billHandler := handlers.NewBillHandler(billService)
	ocrHandler := handlers.NewOCRHandler()

	// API 路由
	api := r.Group("/api/v1")
	{
		// 健康檢查
		api.GET("/health", func(c *gin.Context) {
			c.JSON(200, gin.H{
				"status":  "ok",
				"message": "WattRent API is running",
			})
		})

		// OCR 相關
		api.POST("/ocr/process", ocrHandler.ProcessImage)

		// 帳單相關
		bills := api.Group("/bills")
		{
			bills.POST("", billHandler.CreateBill)
			bills.GET("", billHandler.GetBills)
			bills.GET("/latest", billHandler.GetLatestBill)
			bills.GET("/:id", billHandler.GetBill)
			bills.PUT("/:id", billHandler.UpdateBill)
			bills.PUT("/:id/payment", billHandler.UpdateBillPayment)
			bills.DELETE("/:id", billHandler.DeleteBill)
		}

		// 電表讀數相關
		// TODO: 實作電表讀數相關 API
	}

	// 啟動伺服器
	port := ":8080"
	log.Printf("Server starting on port %s", port)
	if err := r.Run(port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

// curl http://localhost:8090/ping
