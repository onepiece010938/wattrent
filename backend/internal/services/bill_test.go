package services

import (
	"testing"
	"time"
)

// parsePeriod is a pure helper; covering it directly keeps us off Firestore.
func TestParsePeriod(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		input   string
		wantErr bool
		wantY   int
		wantM   time.Month
	}{
		{name: "valid", input: "2025-01", wantErr: false, wantY: 2025, wantM: time.January},
		{name: "valid december", input: "2024-12", wantErr: false, wantY: 2024, wantM: time.December},
		{name: "missing dash", input: "202501", wantErr: true},
		{name: "wrong order", input: "01-2025", wantErr: true},
		{name: "month out of range", input: "2025-13", wantErr: true},
		{name: "empty", input: "", wantErr: true},
		{name: "iso date", input: "2025-01-15", wantErr: true},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			got, err := parsePeriod(tc.input)
			if tc.wantErr {
				if err == nil {
					t.Fatalf("expected error for %q, got nil (parsed=%v)", tc.input, got)
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error for %q: %v", tc.input, err)
			}
			if got.Year() != tc.wantY || got.Month() != tc.wantM {
				t.Fatalf("parsePeriod(%q) = %v, want %d-%02d", tc.input, got, tc.wantY, tc.wantM)
			}
			if got.Day() != 1 {
				t.Fatalf("parsePeriod(%q) day = %d, want 1", tc.input, got.Day())
			}
		})
	}
}

// computeBillTotals mirrors the math inside BillService.Create so we can verify
// the cost/usage formulas without touching Firestore. If you change the formula
// in bill.go, mirror it here and add a row below.
func computeBillTotals(prev, current, rate, rent float64) (usage, cost, total float64) {
	usage = current - prev
	cost = usage * rate
	total = cost + rent
	return
}

func TestBillTotals(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name      string
		prev      float64
		current   float64
		rate      float64
		rent      float64
		wantUsage float64
		wantCost  float64
		wantTotal float64
	}{
		{
			name: "typical month", prev: 1000, current: 1250, rate: 4.5, rent: 8000,
			wantUsage: 250, wantCost: 1125, wantTotal: 9125,
		},
		{
			name: "first bill (no previous)", prev: 0, current: 100, rate: 5, rent: 10000,
			wantUsage: 100, wantCost: 500, wantTotal: 10500,
		},
		{
			name: "no usage this month", prev: 500, current: 500, rate: 4.5, rent: 8000,
			wantUsage: 0, wantCost: 0, wantTotal: 8000,
		},
		{
			name: "fractional reading", prev: 1000.0, current: 1100.5, rate: 4.0, rent: 7500,
			wantUsage: 100.5, wantCost: 402, wantTotal: 7902,
		},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			usage, cost, total := computeBillTotals(tc.prev, tc.current, tc.rate, tc.rent)
			if usage != tc.wantUsage {
				t.Errorf("usage = %v, want %v", usage, tc.wantUsage)
			}
			if cost != tc.wantCost {
				t.Errorf("cost = %v, want %v", cost, tc.wantCost)
			}
			if total != tc.wantTotal {
				t.Errorf("total = %v, want %v", total, tc.wantTotal)
			}
		})
	}
}
