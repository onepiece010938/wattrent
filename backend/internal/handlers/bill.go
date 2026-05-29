// Package handlers is the HTTP handler layer; it deals with request/response
// only and contains no business logic.
//
// Conventions:
//   - Push errors via c.Error(err) into the ErrorHandler middleware; do not
//     write status codes here.
//   - userID always comes from middleware.GetUID(c); a handler must NEVER
//     trust a userId taken from the query string or path.
package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"wattrent/internal/middleware"
	"wattrent/internal/models"
	"wattrent/internal/services"
)

type BillHandler struct {
	bills   *services.BillService
	storage *services.StorageService
}

func NewBillHandler(bills *services.BillService, storage *services.StorageService) *BillHandler {
	return &BillHandler{bills: bills, storage: storage}
}

// resolveViewURL tries to attach a short-lived signed GET URL when the bill
// references a gs:// object. Failure is non-fatal: we log and keep going so
// the detail page still renders.
func (h *BillHandler) resolveViewURL(c *gin.Context, bill *models.Bill) {
	if bill == nil || bill.ImageURL == "" || h.storage == nil {
		return
	}
	url, _, err := h.storage.SignedDownloadURL(c.Request.Context(), bill.ImageURL)
	if err != nil {
		return
	}
	bill.ImageViewURL = url
}

// POST /api/v1/bills
func (h *BillHandler) Create(c *gin.Context) {
	var req models.CreateBillRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		_ = c.Error(&middleware.AppError{HTTPStatus: http.StatusBadRequest, Key: "errors.bad_request", Cause: err})
		return
	}

	bill, err := h.bills.Create(c.Request.Context(), middleware.GetUID(c), &req)
	if err != nil {
		_ = c.Error(err)
		return
	}

	c.JSON(http.StatusCreated, models.ApiResponse{
		Success: true,
		Data:    bill,
		Message: "bills.created",
	})
}

// GET /api/v1/bills
func (h *BillHandler) List(c *gin.Context) {
	bills, err := h.bills.List(c.Request.Context(), middleware.GetUID(c), 50)
	if err != nil {
		_ = c.Error(err)
		return
	}
	c.JSON(http.StatusOK, models.ApiResponse{Success: true, Data: bills})
}

// GET /api/v1/bills/latest
func (h *BillHandler) Latest(c *gin.Context) {
	bill, err := h.bills.Latest(c.Request.Context(), middleware.GetUID(c))
	if err != nil {
		_ = c.Error(err)
		return
	}
	c.JSON(http.StatusOK, models.ApiResponse{Success: true, Data: bill})
}

// GET /api/v1/bills/:id
func (h *BillHandler) Get(c *gin.Context) {
	bill, err := h.bills.Get(c.Request.Context(), middleware.GetUID(c), c.Param("id"))
	if err != nil {
		_ = c.Error(err)
		return
	}
	h.resolveViewURL(c, bill)
	c.JSON(http.StatusOK, models.ApiResponse{Success: true, Data: bill})
}

// PUT /api/v1/bills/:id/payment
func (h *BillHandler) UpdatePayment(c *gin.Context) {
	var req models.UpdateBillPaymentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		_ = c.Error(&middleware.AppError{HTTPStatus: http.StatusBadRequest, Key: "errors.bad_request", Cause: err})
		return
	}

	bill, err := h.bills.SetPaid(c.Request.Context(), middleware.GetUID(c), c.Param("id"), req.Paid)
	if err != nil {
		_ = c.Error(err)
		return
	}
	c.JSON(http.StatusOK, models.ApiResponse{
		Success: true,
		Data:    bill,
		Message: "bills.payment_updated",
	})
}

// DELETE /api/v1/bills/:id
func (h *BillHandler) Delete(c *gin.Context) {
	if err := h.bills.Delete(c.Request.Context(), middleware.GetUID(c), c.Param("id")); err != nil {
		_ = c.Error(err)
		return
	}
	c.JSON(http.StatusOK, models.ApiResponse{Success: true, Message: "bills.deleted"})
}
