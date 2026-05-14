package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"wattrent/internal/middleware"
	"wattrent/internal/models"
	"wattrent/internal/services"
)

type SettingsHandler struct {
	settings *services.SettingsService
}

func NewSettingsHandler(settings *services.SettingsService) *SettingsHandler {
	return &SettingsHandler{settings: settings}
}

// GET /api/v1/settings
func (h *SettingsHandler) Get(c *gin.Context) {
	s, err := h.settings.Get(c.Request.Context(), middleware.GetUID(c))
	if err != nil {
		_ = c.Error(err)
		return
	}
	c.JSON(http.StatusOK, models.ApiResponse{Success: true, Data: s})
}

// PUT /api/v1/settings  (full overwrite)
func (h *SettingsHandler) Save(c *gin.Context) {
	var s models.UserSettings
	if err := c.ShouldBindJSON(&s); err != nil {
		_ = c.Error(&middleware.AppError{HTTPStatus: http.StatusBadRequest, Key: "errors.bad_request", Cause: err})
		return
	}
	if err := h.settings.Save(c.Request.Context(), middleware.GetUID(c), &s); err != nil {
		_ = c.Error(err)
		return
	}
	c.JSON(http.StatusOK, models.ApiResponse{
		Success: true,
		Data:    s,
		Message: "settings.saved",
	})
}

// PATCH /api/v1/settings  (partial update)
func (h *SettingsHandler) Patch(c *gin.Context) {
	var req models.UpdateSettingsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		_ = c.Error(&middleware.AppError{HTTPStatus: http.StatusBadRequest, Key: "errors.bad_request", Cause: err})
		return
	}
	updated, err := h.settings.Patch(c.Request.Context(), middleware.GetUID(c), &req)
	if err != nil {
		_ = c.Error(err)
		return
	}
	c.JSON(http.StatusOK, models.ApiResponse{
		Success: true,
		Data:    updated,
		Message: "settings.updated",
	})
}

// DELETE /api/v1/settings
func (h *SettingsHandler) Delete(c *gin.Context) {
	if err := h.settings.Delete(c.Request.Context(), middleware.GetUID(c)); err != nil {
		_ = c.Error(err)
		return
	}
	c.JSON(http.StatusOK, models.ApiResponse{Success: true, Message: "settings.deleted"})
}
