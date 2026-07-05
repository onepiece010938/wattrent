// Package handlers integration tests.
//
// These tests assemble a Gin router with the same middleware chain used in
// main.go (RequestID + Recovery + CORS + RequestLogger + ErrorHandler + Auth
// bypass + RateLimit) but inject fake services so we can exercise the HTTP
// surface end-to-end without touching Firestore / GCS / Gemini.
package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"

	"wattrent/internal/config"
	"wattrent/internal/middleware"
	"wattrent/internal/models"
)

// ---- test fakes -----------------------------------------------------------

type fakeBillStore struct {
	createFn    func(ctx context.Context, uid string, req *models.CreateBillRequest) (*models.Bill, error)
	getFn       func(ctx context.Context, uid, billID string) (*models.Bill, error)
	listFn      func(ctx context.Context, uid string, limit int) ([]*models.Bill, error)
	latestFn    func(ctx context.Context, uid string) (*models.Bill, error)
	setPaidFn   func(ctx context.Context, uid, billID string, paid bool) (*models.Bill, error)
	deleteFn    func(ctx context.Context, uid, billID string) error
	lastUID     string
	lastBillID  string
	createCalls int
	deleteCalls int
}

func (f *fakeBillStore) Create(ctx context.Context, uid string, req *models.CreateBillRequest) (*models.Bill, error) {
	f.lastUID = uid
	f.createCalls++
	if f.createFn != nil {
		return f.createFn(ctx, uid, req)
	}
	return nil, errors.New("not implemented")
}
func (f *fakeBillStore) Get(ctx context.Context, uid, billID string) (*models.Bill, error) {
	f.lastUID, f.lastBillID = uid, billID
	if f.getFn != nil {
		return f.getFn(ctx, uid, billID)
	}
	return nil, errors.New("not implemented")
}
func (f *fakeBillStore) List(ctx context.Context, uid string, limit int) ([]*models.Bill, error) {
	f.lastUID = uid
	if f.listFn != nil {
		return f.listFn(ctx, uid, limit)
	}
	return nil, errors.New("not implemented")
}
func (f *fakeBillStore) Latest(ctx context.Context, uid string) (*models.Bill, error) {
	f.lastUID = uid
	if f.latestFn != nil {
		return f.latestFn(ctx, uid)
	}
	return nil, nil
}
func (f *fakeBillStore) SetPaid(ctx context.Context, uid, billID string, paid bool) (*models.Bill, error) {
	f.lastUID, f.lastBillID = uid, billID
	if f.setPaidFn != nil {
		return f.setPaidFn(ctx, uid, billID, paid)
	}
	return nil, errors.New("not implemented")
}
func (f *fakeBillStore) Delete(ctx context.Context, uid, billID string) error {
	f.lastUID, f.lastBillID = uid, billID
	f.deleteCalls++
	if f.deleteFn != nil {
		return f.deleteFn(ctx, uid, billID)
	}
	return nil
}

type fakeDownloadSigner struct {
	signFn func(ctx context.Context, gcsPath string) (string, time.Time, error)
}

func (f *fakeDownloadSigner) SignedDownloadURL(ctx context.Context, gcsPath string) (string, time.Time, error) {
	if f.signFn != nil {
		return f.signFn(ctx, gcsPath)
	}
	return "https://signed.example/download?token=abc", time.Now().Add(time.Hour), nil
}

type fakeUploadSigner struct {
	uid, billID, contentType string
	signFn                   func(ctx context.Context, uid, billID, contentType string) (string, string, time.Time, error)
}

func (f *fakeUploadSigner) SignedUploadURL(ctx context.Context, uid, billID, contentType string) (string, string, time.Time, error) {
	f.uid, f.billID, f.contentType = uid, billID, contentType
	if f.signFn != nil {
		return f.signFn(ctx, uid, billID, contentType)
	}
	return "https://signed.example/upload?token=abc",
		"gs://meters/" + uid + "/" + billID + ".jpg",
		time.Now().Add(15 * time.Minute), nil
}

type fakeSettingsStore struct {
	getFn    func(ctx context.Context, uid string) (*models.UserSettings, error)
	saveFn   func(ctx context.Context, uid string, settings *models.UserSettings) error
	patchFn  func(ctx context.Context, uid string, req *models.UpdateSettingsRequest) (*models.UserSettings, error)
	deleteFn func(ctx context.Context, uid string) error
}

func (f *fakeSettingsStore) Get(ctx context.Context, uid string) (*models.UserSettings, error) {
	if f.getFn != nil {
		return f.getFn(ctx, uid)
	}
	s := models.DefaultUserSettings()
	return &s, nil
}
func (f *fakeSettingsStore) Save(ctx context.Context, uid string, settings *models.UserSettings) error {
	if f.saveFn != nil {
		return f.saveFn(ctx, uid, settings)
	}
	return nil
}
func (f *fakeSettingsStore) Patch(ctx context.Context, uid string, req *models.UpdateSettingsRequest) (*models.UserSettings, error) {
	if f.patchFn != nil {
		return f.patchFn(ctx, uid, req)
	}
	s := models.DefaultUserSettings()
	return &s, nil
}
func (f *fakeSettingsStore) Delete(ctx context.Context, uid string) error {
	if f.deleteFn != nil {
		return f.deleteFn(ctx, uid)
	}
	return nil
}

type fakeOCRRunner struct {
	processFn func(ctx context.Context, req *models.OCRRequest) (*models.OCRResponse, error)
}

func (f *fakeOCRRunner) Process(ctx context.Context, req *models.OCRRequest) (*models.OCRResponse, error) {
	if f.processFn != nil {
		return f.processFn(ctx, req)
	}
	return &models.OCRResponse{Reading: 1234.5, Confidence: 0.9, Model: "fake"}, nil
}

type fakeUserStore struct {
	upsertFn func(ctx context.Context, uid, email, displayName, photoURL string) (*models.User, error)
	getFn    func(ctx context.Context, uid string) (*models.User, error)
}

func (f *fakeUserStore) UpsertProfile(ctx context.Context, uid, email, displayName, photoURL string) (*models.User, error) {
	if f.upsertFn != nil {
		return f.upsertFn(ctx, uid, email, displayName, photoURL)
	}
	now := time.Now()
	return &models.User{ID: uid, Email: email, DisplayName: displayName, PhotoURL: photoURL, CreatedAt: now, UpdatedAt: now}, nil
}
func (f *fakeUserStore) Get(ctx context.Context, uid string) (*models.User, error) {
	if f.getFn != nil {
		return f.getFn(ctx, uid)
	}
	return nil, nil
}

type fakeAccountDeleter struct {
	deleteFn func(ctx context.Context, uid string) error
	clearFn  func(ctx context.Context, uid string) error
	calls    int
	clears   int
	lastUID  string
}

func (f *fakeAccountDeleter) DeleteAccount(ctx context.Context, uid string) error {
	f.calls++
	f.lastUID = uid
	if f.deleteFn != nil {
		return f.deleteFn(ctx, uid)
	}
	return nil
}

func (f *fakeAccountDeleter) ClearData(ctx context.Context, uid string) error {
	f.clears++
	f.lastUID = uid
	if f.clearFn != nil {
		return f.clearFn(ctx, uid)
	}
	return nil
}

// ---- router builder -------------------------------------------------------

// testEnv bundles the fakes used by a single test plus the router.
type testEnv struct {
	router   *gin.Engine
	bills    *fakeBillStore
	settings *fakeSettingsStore
	ocr      *fakeOCRRunner
	uploads  *fakeUploadSigner
	users    *fakeUserStore
	account  *fakeAccountDeleter
	download *fakeDownloadSigner
	line     *fakeLineExchanger
}

// newTestEnv wires a router with the same middleware chain as main.go but
// uses AuthBypass so we don't need a real Firebase Auth client.
func newTestEnv(t *testing.T) *testEnv {
	t.Helper()
	gin.SetMode(gin.TestMode)

	env := &testEnv{
		bills:    &fakeBillStore{},
		settings: &fakeSettingsStore{},
		ocr:      &fakeOCRRunner{},
		uploads:  &fakeUploadSigner{},
		users:    &fakeUserStore{},
		account:  &fakeAccountDeleter{},
		download: &fakeDownloadSigner{},
		line:     &fakeLineExchanger{},
	}

	cfg := &config.Config{
		Env:            "dev",
		AllowedOrigins: []string{"*"},
		AuthBypass:     true,
		AuthBypassUID:  "test-uid",
	}

	r := gin.New()
	r.Use(middleware.RequestID())
	r.Use(gin.Recovery())
	r.Use(middleware.CORS(cfg))
	r.Use(middleware.RequestLogger())
	r.Use(middleware.ErrorHandler())

	r.GET("/health", func(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"status": "ok"}) })

	billH := NewBillHandler(env.bills, env.download)
	settingsH := NewSettingsHandler(env.settings)
	ocrH := NewOCRHandler(env.ocr)
	uploadH := NewUploadHandler(env.uploads)
	userH := NewUserHandler(env.users)
	accountH := NewAccountHandler(env.account)
	lineH := NewLINEAuthHandler(env.line)

	api := r.Group("/api/v1")
	// LINE token exchange lives OUTSIDE the authed group because it is the
	// flow that mints the very Bearer token everything else requires.
	api.POST("/auth/line/exchange", lineH.Exchange)
	authed := api.Group("")
	authed.Use(middleware.Auth(nil, cfg)) // nil firebase client is fine because AuthBypass=true
	{
		authed.GET("/users/me", userH.GetMe)
		authed.POST("/users/me", userH.UpsertMe)
		authed.DELETE("/users/me", accountH.DeleteMe)
		authed.DELETE("/users/me/data", accountH.ClearData)
		authed.POST("/ocr/process", ocrH.Process)
		authed.POST("/uploads/sign", uploadH.Sign)
		bills := authed.Group("/bills")
		bills.POST("", billH.Create)
		bills.GET("", billH.List)
		bills.GET("/latest", billH.Latest)
		bills.GET("/:id", billH.Get)
		bills.PUT("/:id/payment", billH.UpdatePayment)
		bills.DELETE("/:id", billH.Delete)
		settings := authed.Group("/settings")
		settings.GET("", settingsH.Get)
		settings.PUT("", settingsH.Save)
		settings.PATCH("", settingsH.Patch)
		settings.DELETE("", settingsH.Delete)
	}

	env.router = r
	return env
}

// do is a thin httptest helper.
func (e *testEnv) do(t *testing.T, method, target string, body any) *httptest.ResponseRecorder {
	t.Helper()
	var reader *bytes.Reader
	if body != nil {
		raw, err := json.Marshal(body)
		if err != nil {
			t.Fatalf("marshal body: %v", err)
		}
		reader = bytes.NewReader(raw)
	} else {
		reader = bytes.NewReader(nil)
	}
	req := httptest.NewRequest(method, target, reader)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	rec := httptest.NewRecorder()
	e.router.ServeHTTP(rec, req)
	return rec
}

// decode unmarshals an ApiResponse body and returns the parsed envelope. The
// caller can re-marshal env.Data to assert on inner fields.
func decode(t *testing.T, rec *httptest.ResponseRecorder) models.ApiResponse {
	t.Helper()
	var env models.ApiResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &env); err != nil {
		t.Fatalf("decode body %q: %v", rec.Body.String(), err)
	}
	return env
}

// dataAs marshals env.Data back to JSON then decodes into out.
func dataAs(t *testing.T, env models.ApiResponse, out any) {
	t.Helper()
	raw, err := json.Marshal(env.Data)
	if err != nil {
		t.Fatalf("re-marshal data: %v", err)
	}
	if err := json.Unmarshal(raw, out); err != nil {
		t.Fatalf("decode data: %v", err)
	}
}
