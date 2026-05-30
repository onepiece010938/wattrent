package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"wattrent/internal/middleware"
	"wattrent/internal/models"
)

type OCRHandler struct {
	ocr ocrRunner
}

func NewOCRHandler(ocr ocrRunner) *OCRHandler {
	return &OCRHandler{ocr: ocr}
}

// POST /api/v1/ocr/process
//
// Body:
//
//	{ "imageBase64": "...", "imageUrl": "gs://..." }  // pick one
func (h *OCRHandler) Process(c *gin.Context) {
	var req models.OCRRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		_ = c.Error(&middleware.AppError{HTTPStatus: http.StatusBadRequest, Key: "errors.bad_request", Cause: err})
		return
	}

	resp, err := h.ocr.Process(c.Request.Context(), &req)
	if err != nil {
		_ = c.Error(err)
		return
	}
	c.JSON(http.StatusOK, models.ApiResponse{
		Success: true,
		Data:    resp,
		Message: "ocr.processed",
	})
}
