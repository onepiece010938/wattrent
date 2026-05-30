package handlers

import (
	"context"
	"net/http"
	"testing"
	"time"

	"wattrent/internal/middleware"
	"wattrent/internal/models"
)

func TestBillHandler_Create_Success(t *testing.T) {
	env := newTestEnv(t)
	env.bills.createFn = func(ctx context.Context, uid string, req *models.CreateBillRequest) (*models.Bill, error) {
		if uid != "test-uid" {
			t.Errorf("uid = %q, want test-uid", uid)
		}
		return &models.Bill{ID: "bill-1", Period: req.Period, MeterReading: req.MeterReading, TotalAmount: 1000}, nil
	}

	rec := env.do(t, "POST", "/api/v1/bills", map[string]any{
		"meterReading":    1500.5,
		"electricityRate": 4.5,
		"rent":            8000,
		"period":          "2026-05",
	})
	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d, body=%s", rec.Code, rec.Body.String())
	}
	env2 := decode(t, rec)
	if !env2.Success || env2.Message != "bills.created" {
		t.Errorf("envelope = %+v, want success+bills.created", env2)
	}
	var b models.Bill
	dataAs(t, env2, &b)
	if b.ID != "bill-1" {
		t.Errorf("bill id = %q", b.ID)
	}
}

func TestBillHandler_Create_BadJSON(t *testing.T) {
	env := newTestEnv(t)
	rec := env.do(t, "POST", "/api/v1/bills", map[string]any{
		"meterReading": -5, // fails gte=0
	})
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400; body=%s", rec.Code, rec.Body.String())
	}
	env2 := decode(t, rec)
	if env2.Success || env2.Error != "errors.bad_request" {
		t.Errorf("envelope = %+v, want failed+errors.bad_request", env2)
	}
}

func TestBillHandler_Create_ServicePropagatesAppError(t *testing.T) {
	env := newTestEnv(t)
	env.bills.createFn = func(ctx context.Context, uid string, req *models.CreateBillRequest) (*models.Bill, error) {
		return nil, &middleware.AppError{HTTPStatus: 400, Key: "errors.bill.reading_decreased"}
	}
	rec := env.do(t, "POST", "/api/v1/bills", map[string]any{
		"meterReading":    100,
		"electricityRate": 4.5,
		"rent":            8000,
		"period":          "2026-05",
	})
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, body=%s", rec.Code, rec.Body.String())
	}
	if got := decode(t, rec).Error; got != "errors.bill.reading_decreased" {
		t.Errorf("Error = %q", got)
	}
}

func TestBillHandler_List(t *testing.T) {
	env := newTestEnv(t)
	env.bills.listFn = func(ctx context.Context, uid string, limit int) ([]*models.Bill, error) {
		return []*models.Bill{
			{ID: "b1", Period: "2026-05", TotalAmount: 500},
			{ID: "b2", Period: "2026-04", TotalAmount: 600},
		}, nil
	}
	rec := env.do(t, "GET", "/api/v1/bills", nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body=%s", rec.Code, rec.Body.String())
	}
	var bills []models.Bill
	dataAs(t, decode(t, rec), &bills)
	if len(bills) != 2 || bills[0].ID != "b1" {
		t.Errorf("bills = %+v", bills)
	}
}

func TestBillHandler_Latest_None(t *testing.T) {
	env := newTestEnv(t)
	// default fakeBillStore.latestFn returns nil, nil
	rec := env.do(t, "GET", "/api/v1/bills/latest", nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
	env2 := decode(t, rec)
	if !env2.Success {
		t.Errorf("envelope = %+v", env2)
	}
}

func TestBillHandler_Get_AttachesViewURL(t *testing.T) {
	env := newTestEnv(t)
	env.bills.getFn = func(ctx context.Context, uid, billID string) (*models.Bill, error) {
		return &models.Bill{ID: billID, ImageURL: "gs://meters/test-uid/abc.jpg"}, nil
	}
	env.download.signFn = func(ctx context.Context, gcsPath string) (string, time.Time, error) {
		return "https://signed.example/view?token=z", time.Now().Add(time.Hour), nil
	}
	rec := env.do(t, "GET", "/api/v1/bills/bill-1", nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
	var b models.Bill
	dataAs(t, decode(t, rec), &b)
	if b.ImageViewURL == "" {
		t.Error("expected ImageViewURL to be populated by handler.resolveViewURL")
	}
}

func TestBillHandler_Get_NotFound(t *testing.T) {
	env := newTestEnv(t)
	env.bills.getFn = func(ctx context.Context, uid, billID string) (*models.Bill, error) {
		return nil, &middleware.AppError{HTTPStatus: 404, Key: "errors.bill.not_found"}
	}
	rec := env.do(t, "GET", "/api/v1/bills/missing", nil)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d", rec.Code)
	}
	if got := decode(t, rec).Error; got != "errors.bill.not_found" {
		t.Errorf("Error = %q", got)
	}
}

func TestBillHandler_UpdatePayment(t *testing.T) {
	env := newTestEnv(t)
	env.bills.setPaidFn = func(ctx context.Context, uid, billID string, paid bool) (*models.Bill, error) {
		if !paid {
			t.Errorf("paid = false, want true")
		}
		now := time.Now()
		return &models.Bill{ID: billID, PaidAt: &now}, nil
	}
	rec := env.do(t, "PUT", "/api/v1/bills/bill-1/payment", map[string]any{"paid": true})
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body=%s", rec.Code, rec.Body.String())
	}
	if got := decode(t, rec).Message; got != "bills.payment_updated" {
		t.Errorf("Message = %q", got)
	}
}

func TestBillHandler_Delete(t *testing.T) {
	env := newTestEnv(t)
	rec := env.do(t, "DELETE", "/api/v1/bills/bill-x", nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body=%s", rec.Code, rec.Body.String())
	}
	if env.bills.deleteCalls != 1 || env.bills.lastBillID != "bill-x" {
		t.Errorf("delete: calls=%d id=%q", env.bills.deleteCalls, env.bills.lastBillID)
	}
	if got := decode(t, rec).Message; got != "bills.deleted" {
		t.Errorf("Message = %q", got)
	}
}
