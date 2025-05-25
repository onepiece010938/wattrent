package services

import (
	"errors"
	"sort"
	"sync"
	"wattrent/internal/models"
)

type BillService struct {
	// 暫時使用記憶體儲存，之後替換為 DynamoDB
	bills         map[string]*models.Bill
	meterReadings map[string]*models.MeterReading
	mu            sync.RWMutex
}

func NewBillService() *BillService {
	return &BillService{
		bills:         make(map[string]*models.Bill),
		meterReadings: make(map[string]*models.MeterReading),
	}
}

// SaveBill 儲存帳單
func (s *BillService) SaveBill(bill *models.Bill) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.bills[bill.ID] = bill
	return nil
}

// GetBillByID 根據 ID 獲取帳單
func (s *BillService) GetBillByID(billID string) (*models.Bill, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	bill, exists := s.bills[billID]
	if !exists {
		return nil, errors.New("帳單不存在")
	}

	return bill, nil
}

// GetBillsByUserID 獲取用戶的所有帳單
func (s *BillService) GetBillsByUserID(userID string) ([]*models.Bill, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var userBills []*models.Bill
	for _, bill := range s.bills {
		if bill.UserID == userID {
			userBills = append(userBills, bill)
		}
	}

	// 按建立時間排序（新的在前）
	sort.Slice(userBills, func(i, j int) bool {
		return userBills[i].CreatedAt.After(userBills[j].CreatedAt)
	})

	return userBills, nil
}

// UpdateBill 更新帳單
func (s *BillService) UpdateBill(bill *models.Bill) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, exists := s.bills[bill.ID]; !exists {
		return errors.New("帳單不存在")
	}

	s.bills[bill.ID] = bill
	return nil
}

// GetLatestBill 獲取最新帳單
func (s *BillService) GetLatestBill(userID string) (*models.Bill, error) {
	bills, err := s.GetBillsByUserID(userID)
	if err != nil {
		return nil, err
	}

	if len(bills) == 0 {
		return nil, errors.New("無帳單記錄")
	}

	return bills[0], nil
}

// SaveMeterReading 儲存電表讀數
func (s *BillService) SaveMeterReading(reading *models.MeterReading) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.meterReadings[reading.ID] = reading
	return nil
}

// GetLastMeterReading 獲取最後一次電表讀數
func (s *BillService) GetLastMeterReading(userID string) (*models.MeterReading, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var userReadings []*models.MeterReading
	for _, reading := range s.meterReadings {
		if reading.UserID == userID {
			userReadings = append(userReadings, reading)
		}
	}

	if len(userReadings) == 0 {
		return nil, errors.New("無讀數記錄")
	}

	// 按建立時間排序（新的在前）
	sort.Slice(userReadings, func(i, j int) bool {
		return userReadings[i].CreatedAt.After(userReadings[j].CreatedAt)
	})

	return userReadings[0], nil
}

// DeleteBill 刪除帳單
func (s *BillService) DeleteBill(billID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, exists := s.bills[billID]; !exists {
		return errors.New("帳單不存在")
	}

	delete(s.bills, billID)
	return nil
}
