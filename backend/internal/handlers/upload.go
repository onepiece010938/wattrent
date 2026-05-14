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
// Hand the frontend a PUT signed URL so it can upload the meter photo straight
// to GCS.
//
// Flow:
//  1. Frontend POSTs {billId, contentType} here.
//  2. Backend returns {uploadUrl, gcsPath, expiresAt}.
//  3. Frontend PUTs the image to uploadUrl (HTTP body = binary).
//  4. Frontend POSTs /bills with imageUrl=gcsPath.
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
