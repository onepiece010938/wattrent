package services

import (
	"context"
	"fmt"
	"time"

	"cloud.google.com/go/firestore"
	"google.golang.org/api/iterator"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"wattrent/internal/middleware"
	"wattrent/internal/models"
)

// BillService operates on /users/{uid}/bills/{billId}.
type BillService struct {
	fs       *firestore.Client
	settings *SettingsService
}

func NewBillService(fs *firestore.Client, settings *SettingsService) *BillService {
	return &BillService{fs: fs, settings: settings}
}

func (s *BillService) billsCol(uid string) *firestore.CollectionRef {
	return s.fs.Collection("users").Doc(uid).Collection("bills")
}

// Create creates a new bill.
//
// Inside one transaction:
//  1. Write the new bill.
//  2. Update settings.previousMeterReading to this reading.
//
// Note: previousReading is taken from the current settings; if this is the
// first bill, previousReading=0.
func (s *BillService) Create(ctx context.Context, uid string, req *models.CreateBillRequest) (*models.Bill, error) {
	periodStart, err := parsePeriod(req.Period)
	if err != nil {
		return nil, &middleware.AppError{
			HTTPStatus: 400,
			Key:        "errors.bill.invalid_period",
			Cause:      err,
		}
	}

	settingsRef := s.fs.Collection("users").Doc(uid).Collection("settings").Doc(settingsDocID)
	billRef := s.billsCol(uid).NewDoc()

	var created models.Bill

	err = s.fs.RunTransaction(ctx, func(ctx context.Context, tx *firestore.Transaction) error {
		// 1. Read the previous meter reading from settings (default 0 if missing)
		var prevReading float64
		if snap, err := tx.Get(settingsRef); err == nil {
			if v, err := snap.DataAt("previousMeterReading"); err == nil {
				if f, ok := v.(float64); ok {
					prevReading = f
				}
			}
		} else if status.Code(err) != codes.NotFound {
			return err
		}

		if req.MeterReading < prevReading {
			return &middleware.AppError{
				HTTPStatus: 400,
				Key:        "errors.bill.reading_decreased",
			}
		}

		usage := req.MeterReading - prevReading
		electricityCost := usage * req.ElectricityRate
		now := time.Now().UTC()

		bill := models.Bill{
			Period:           req.Period,
			PeriodStart:      periodStart,
			MeterReading:     req.MeterReading,
			PreviousReading:  prevReading,
			ElectricityUsage: usage,
			ElectricityRate:  req.ElectricityRate,
			ElectricityCost:  electricityCost,
			Rent:             req.Rent,
			TotalAmount:      electricityCost + req.Rent,
			ImageURL:         req.ImageURL,
			CreatedAt:        now,
			UpdatedAt:        now,
		}

		if err := tx.Set(billRef, bill); err != nil {
			return err
		}

		// 2. Update settings.previousMeterReading
		if err := tx.Set(settingsRef, map[string]interface{}{
			"previousMeterReading": req.MeterReading,
			"updatedAt":            firestore.ServerTimestamp,
		}, firestore.MergeAll); err != nil {
			return err
		}

		bill.ID = billRef.ID
		created = bill
		return nil
	})
	if err != nil {
		return nil, err
	}

	return &created, nil
}

// Get fetches a single bill.
func (s *BillService) Get(ctx context.Context, uid, billID string) (*models.Bill, error) {
	snap, err := s.billsCol(uid).Doc(billID).Get(ctx)
	if err != nil {
		if status.Code(err) == codes.NotFound {
			return nil, &middleware.AppError{
				HTTPStatus: 404,
				Key:        "errors.bill.not_found",
			}
		}
		return nil, err
	}
	return docToBill(snap)
}

// List lists every bill for a user (newest first).
func (s *BillService) List(ctx context.Context, uid string, limit int) ([]*models.Bill, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}

	q := s.billsCol(uid).OrderBy("createdAt", firestore.Desc).Limit(limit)
	iter := q.Documents(ctx)
	defer iter.Stop()

	bills := make([]*models.Bill, 0, limit)
	for {
		snap, err := iter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			return nil, err
		}
		b, err := docToBill(snap)
		if err != nil {
			return nil, err
		}
		bills = append(bills, b)
	}
	return bills, nil
}

// Latest returns the most recent bill.
func (s *BillService) Latest(ctx context.Context, uid string) (*models.Bill, error) {
	bills, err := s.List(ctx, uid, 1)
	if err != nil {
		return nil, err
	}
	if len(bills) == 0 {
		return nil, nil
	}
	return bills[0], nil
}

// SetPaid toggles the payment status. paid=true -> paidAt=now; paid=false -> paidAt=nil.
func (s *BillService) SetPaid(ctx context.Context, uid, billID string, paid bool) (*models.Bill, error) {
	updates := []firestore.Update{
		{Path: "updatedAt", Value: firestore.ServerTimestamp},
	}
	if paid {
		updates = append(updates, firestore.Update{Path: "paidAt", Value: firestore.ServerTimestamp})
	} else {
		updates = append(updates, firestore.Update{Path: "paidAt", Value: nil})
	}

	if _, err := s.billsCol(uid).Doc(billID).Update(ctx, updates); err != nil {
		if status.Code(err) == codes.NotFound {
			return nil, &middleware.AppError{HTTPStatus: 404, Key: "errors.bill.not_found"}
		}
		return nil, err
	}
	return s.Get(ctx, uid, billID)
}

// Delete deletes a bill; paid bills cannot be deleted.
func (s *BillService) Delete(ctx context.Context, uid, billID string) error {
	bill, err := s.Get(ctx, uid, billID)
	if err != nil {
		return err
	}
	if bill.PaidAt != nil {
		return &middleware.AppError{
			HTTPStatus: 409,
			Key:        "errors.bill.cannot_delete_paid",
		}
	}
	_, err = s.billsCol(uid).Doc(billID).Delete(ctx)
	return err
}

// ----------------------- helpers -----------------------

// parsePeriod converts "YYYY-MM" to time.Time (first day of the month at 00:00 Asia/Taipei).
func parsePeriod(period string) (time.Time, error) {
	loc, _ := time.LoadLocation("Asia/Taipei")
	t, err := time.ParseInLocation("2006-01", period, loc)
	if err != nil {
		return time.Time{}, fmt.Errorf("invalid period %q (expected YYYY-MM): %w", period, err)
	}
	return t, nil
}

func docToBill(snap *firestore.DocumentSnapshot) (*models.Bill, error) {
	var bill models.Bill
	if err := snap.DataTo(&bill); err != nil {
		return nil, err
	}
	bill.ID = snap.Ref.ID
	return &bill, nil
}
