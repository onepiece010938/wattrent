package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"wattrent/internal/middleware"
	"wattrent/internal/models"
	"wattrent/internal/services"
)

type UserHandler struct {
	users *services.UserService
}

func NewUserHandler(users *services.UserService) *UserHandler {
	return &UserHandler{users: users}
}

// upsertProfileRequest is the optional body for POST /api/v1/users/me. The uid
// always comes from the verified Auth token; everything in the body is just
// "best known" client-side hints that may overwrite the matching token claims
// when the IdP didn't propagate them (e.g. some custom providers).
type upsertProfileRequest struct {
	DisplayName string `json:"displayName"`
	PhotoURL    string `json:"photoUrl"`
}

// POST /api/v1/users/me
//
// Called by the frontend right after Firebase Auth signs the user in. The
// backend uses the verified token (uid + email) to create or refresh the
// /users/{uid} document. Idempotent.
func (h *UserHandler) UpsertMe(c *gin.Context) {
	var req upsertProfileRequest
	// Body is optional; ignore parse errors and fall back to token claims only.
	_ = c.ShouldBindJSON(&req)

	uid := middleware.GetUID(c)
	email := middleware.GetEmail(c)

	user, err := h.users.UpsertProfile(c.Request.Context(), uid, email, req.DisplayName, req.PhotoURL)
	if err != nil {
		_ = c.Error(err)
		return
	}
	c.JSON(http.StatusOK, models.ApiResponse{
		Success: true,
		Data:    user,
		Message: "users.bootstrapped",
	})
}

// GET /api/v1/users/me
//
// Returns the user doc, or 404 if it doesn't exist yet (frontend should then
// POST to /users/me to create it). Cheap; safe to call on app launch.
func (h *UserHandler) GetMe(c *gin.Context) {
	uid := middleware.GetUID(c)
	user, err := h.users.Get(c.Request.Context(), uid)
	if err != nil {
		_ = c.Error(err)
		return
	}
	if user == nil {
		_ = c.Error(&middleware.AppError{HTTPStatus: http.StatusNotFound, Key: "errors.user.not_found"})
		return
	}
	c.JSON(http.StatusOK, models.ApiResponse{Success: true, Data: user})
}
