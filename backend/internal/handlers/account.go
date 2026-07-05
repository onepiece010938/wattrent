package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"wattrent/internal/middleware"
	"wattrent/internal/models"
)

// AccountHandler owns account-level operations that span multiple stores:
// full deletion and a data-only wipe.
type AccountHandler struct {
	accounts accountManager
}

func NewAccountHandler(accounts accountManager) *AccountHandler {
	return &AccountHandler{accounts: accounts}
}

// DeleteMe permanently deletes the caller's account and all associated data
// (meter photos, bills, settings, and the login itself). The uid always comes
// from the verified token — never the body — so one user can never delete
// another's account.
//
// DELETE /api/v1/users/me
func (h *AccountHandler) DeleteMe(c *gin.Context) {
	uid := middleware.GetUID(c)
	if err := h.accounts.DeleteAccount(c.Request.Context(), uid); err != nil {
		_ = c.Error(err)
		return
	}
	c.JSON(http.StatusOK, models.ApiResponse{
		Success: true,
		Message: "users.account_deleted",
	})
}

// ClearData wipes the caller's content (meter photos, bills, settings) while
// keeping the account and login. The uid always comes from the verified token.
//
// DELETE /api/v1/users/me/data
func (h *AccountHandler) ClearData(c *gin.Context) {
	uid := middleware.GetUID(c)
	if err := h.accounts.ClearData(c.Request.Context(), uid); err != nil {
		_ = c.Error(err)
		return
	}
	c.JSON(http.StatusOK, models.ApiResponse{
		Success: true,
		Message: "users.data_cleared",
	})
}
