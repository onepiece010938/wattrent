// Package handlers HTTP handler 層；負責 request/response，不包業務邏輯。
//
// 規範：
//   - 用 c.Error(err) 推到 ErrorHandler middleware；不要自己寫 status code
//   - userID 永遠來自 middleware.GetUID(c)；handler 不可以信任 query/path 的 userId
package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"wattrent/internal/middleware"
	"wattrent/internal/models"
	"wattrent/internal/services"
)

type BillHandler struct {
	bills *services.BillService
}

func NewBillHandler(bills *services.BillService) *BillHandler {
	return &BillHandler{bills: bills}
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
