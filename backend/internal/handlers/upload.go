package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"wattrent/internal/middleware"
	"wattrent/internal/models"
	"wattrent/internal/services"
)

type UploadHandler struct {
	storage *services.StorageService
}

func NewUploadHandler(storage *services.StorageService) *UploadHandler {
	return &UploadHandler{storage: storage}
}

// POST /api/v1/uploads/sign
//
// 給前端拿一個 PUT signed URL，直接把電表照片丟進 GCS。
//
// 流程：
//  1. 前端先 POST {billId, contentType} 過來
//  2. 後端回 {uploadUrl, gcsPath, expiresAt}
//  3. 前端 PUT 圖片到 uploadUrl（HTTP body = binary）
//  4. 前端 POST /bills 時帶 imageUrl=gcsPath
func (h *UploadHandler) Sign(c *gin.Context) {
	var req models.SignedUploadRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		_ = c.Error(&middleware.AppError{HTTPStatus: http.StatusBadRequest, Key: "errors.bad_request", Cause: err})
		return
	}

	uid := middleware.GetUID(c)
	uploadURL, gcsPath, expiresAt, err := h.storage.SignedUploadURL(c.Request.Context(), uid, req.BillID, req.ContentType)
	if err != nil {
		_ = c.Error(&middleware.AppError{HTTPStatus: http.StatusInternalServerError, Key: "errors.upload.sign_failed", Cause: err})
		return
	}

	c.JSON(http.StatusOK, models.ApiResponse{
		Success: true,
		Data: models.SignedUploadResponse{
			UploadURL: uploadURL,
			GcsPath:   gcsPath,
			ExpiresAt: expiresAt.Format("2006-01-02T15:04:05Z07:00"),
		},
	})
}
