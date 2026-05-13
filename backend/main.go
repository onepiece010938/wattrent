// Cloud Run entry point.
//
// 啟動順序：
//  1. config.Load 讀環境變數
//  2. clients.New 建 Firestore / Storage / Gemini（AI Studio 或 Vertex） / Firebase Auth
//  3. services 注入 client
//  4. handlers 注入 service
//  5. router + middleware
//  6. graceful shutdown：收到 SIGINT / SIGTERM 後等請求結束才退出
package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"

	"wattrent/internal/clients"
	"wattrent/internal/config"
	"wattrent/internal/handlers"
	"wattrent/internal/middleware"
	"wattrent/internal/services"
)

// version 由 build flag 注入：-ldflags "-X main.version=$SHA"
var version = "dev"

func main() {
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, nil)))
	slog.Info("wattrent api starting", "version", version)

	cfg, err := config.Load()
	if err != nil {
		slog.Error("config load failed", "err", err)
		os.Exit(1)
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	cls, err := clients.New(ctx, cfg)
	if err != nil {
		slog.Error("clients init failed", "err", err)
		os.Exit(1)
	}
	defer func() {
		if err := cls.Close(); err != nil {
			slog.Error("clients close failed", "err", err)
		}
	}()

	settingsSvc := services.NewSettingsService(cls.Firestore)
	billSvc := services.NewBillService(cls.Firestore, settingsSvc)
	storageSvc := services.NewStorageService(cls.Storage, cfg.MetersBucket)
	ocrSvc := services.NewOCRService(cls.Gemini, storageSvc, cfg.GeminiModel)

	router := buildRouter(cfg, cls, settingsSvc, billSvc, storageSvc, ocrSvc)

	server := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           router,
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      60 * time.Second,
		IdleTimeout:       120 * time.Second,
	}

	go func() {
		slog.Info("listening", "port", cfg.Port)
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			slog.Error("server error", "err", err)
			stop()
		}
	}()

	<-ctx.Done()
	slog.Info("shutdown signal received")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	if err := server.Shutdown(shutdownCtx); err != nil {
		slog.Error("graceful shutdown failed", "err", err)
	}
	slog.Info("server stopped")
}

func buildRouter(
	cfg *config.Config,
	cls *clients.Clients,
	settingsSvc *services.SettingsService,
	billSvc *services.BillService,
	storageSvc *services.StorageService,
	ocrSvc *services.OCRService,
) *gin.Engine {
	if cfg.Env == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.New()
	r.Use(gin.Recovery())
	r.Use(middleware.CORS(cfg))
	r.Use(middleware.ErrorHandler())

	// Cloud Run health check（不需 auth）
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok", "version": version})
	})

	// Handlers
	billHandler := handlers.NewBillHandler(billSvc)
	settingsHandler := handlers.NewSettingsHandler(settingsSvc)
	ocrHandler := handlers.NewOCRHandler(ocrSvc)
	uploadHandler := handlers.NewUploadHandler(storageSvc)

	api := r.Group("/api/v1")
	api.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok", "version": version})
	})

	// 以下全部需要 auth
	authed := api.Group("")
	authed.Use(middleware.Auth(cls.Auth, cfg))
	{
		// OCR
		authed.POST("/ocr/process", ocrHandler.Process)

		// Uploads
		authed.POST("/uploads/sign", uploadHandler.Sign)

		// Bills
		bills := authed.Group("/bills")
		bills.POST("", billHandler.Create)
		bills.GET("", billHandler.List)
		bills.GET("/latest", billHandler.Latest)
		bills.GET("/:id", billHandler.Get)
		bills.PUT("/:id/payment", billHandler.UpdatePayment)
		bills.DELETE("/:id", billHandler.Delete)

		// Settings（不再帶 :userId，uid 從 token）
		settings := authed.Group("/settings")
		settings.GET("", settingsHandler.Get)
		settings.PUT("", settingsHandler.Save)
		settings.PATCH("", settingsHandler.Patch)
		settings.DELETE("", settingsHandler.Delete)
	}

	return r
}
