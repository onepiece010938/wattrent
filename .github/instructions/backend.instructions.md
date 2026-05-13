---
applyTo: "backend/**"
description: "WattRent 後端（Go + Gin + Firestore + Gemini OCR）開發規範"
---

# 後端 — Go + Gin + GCP 指南

> 此規則自動套用在 `backend/**` 之下的所有檔案。

## 技術堆疊

| 項目 | 版本 / 套件 |
| --- | --- |
| 語言 | Go **1.25.0**（`go.mod` 為準；Dockerfile 走 `golang:1.25-alpine` 浮動 tag） |
| Web 框架 | `github.com/gin-gonic/gin` v1.12 |
| CORS | `github.com/gin-contrib/cors` v1.7 |
| Firestore | `cloud.google.com/go/firestore` |
| Cloud Storage | `cloud.google.com/go/storage` |
| Gemini（AI Studio 或 Vertex AI） | `google.golang.org/genai`（unified SDK） |
| Firebase Auth | `firebase.google.com/go/v4` |
| 熱重載 | `github.com/air-verse/air`（設定見 `.air.toml`） |

## 目錄與責任

```
backend/
├── main.go                 程式入口（config → clients → services → router → graceful shutdown）
├── Dockerfile              multi-stage、distroless runtime、靜態編譯
├── .env.example            本地開發環境變數樣板
├── .air.toml               熱重載設定
└── internal/
    ├── config/             環境變數集中載入；其他套件不得直接讀 os.Getenv
    ├── clients/            外部 SDK client 統一建構與關閉
    ├── handlers/           接 gin.Context；不放業務邏輯
    ├── services/           業務邏輯：bill、settings、storage（簽名 URL + 下載）、ocr（Gemini）
    ├── models/             API DTO + Firestore document（共用）
    └── middleware/         CORS、Auth（Firebase ID token）、ErrorHandler
```

## 資料層（Firestore）

Schema 設計詳見本機 `docs/firestore-schema.md`（該資料夾不進 repo）。重點：

* 全部使用 subcollection：`/users/{uid}/bills/{billId}`、`/users/{uid}/settings/current`。
* **不存** `userId` 欄位；路徑就是 owner。
* document ID 由 Firestore auto-id 生成；`models.Bill.ID` 等用 `firestore:"-"` 排除，handler 從 `snap.Ref.ID` 補。
* Settings 永遠是 `/users/{uid}/settings/current` 這個固定 ID。
* 寫入時 `UpdatedAt` 用 `firestore.ServerTimestamp` 而不是 `time.Now()`。
* 跨文件原子操作用 `RunTransaction`（見 `BillService.Create`）。
* 用 `status.Code(err) == codes.NotFound` 區分「找不到」與「真錯誤」。

## 認證

* 所有 endpoint（除 `/health`）都掛 `middleware.Auth(...)`。
* uid **永遠**從 `middleware.GetUID(c)` 取，不可信任 client 傳的 `userId` 參數。
* 本地開發：`AUTH_BYPASS=true` + `AUTH_BYPASS_UID=dev-user`；production 強制 `false`（`config.Load` 會檢查）。
* Firebase ID token verify timeout 5s。

## 錯誤處理

* Service / handler 一律用 `c.Error(err)` 推到 `middleware.ErrorHandler()`，**不要**自己 `c.JSON(500, ...)`。
* 業務錯誤用 `*middleware.AppError{HTTPStatus, Key, Cause}`，`Key` 是 i18n key（例：`errors.bill.not_found`）。
* gRPC error 自動對應：`NotFound → 404`、`Unauthenticated → 401`、`InvalidArgument → 400`、`Unavailable → 502`。
* 不要 `panic` / `log.Fatal` 中斷請求；`gin.Recovery()` 已設好兜底。

## API 慣例

* 路徑：`/api/v1/{resource}`；複數名詞；RESTful。
* Body：JSON；request struct 用 `binding:"required,gte=0"` 等驗證標籤。
* 回應：`models.ApiResponse{Success, Data, Error, Message}`，`Error` / `Message` 都是 i18n key。
* 不在後端組中文字串給使用者看（付款訊息 → 前端 `t('history.billMessage', {...})`）。

## OCR（Gemini）

* 後端：`AI_BACKEND=gemini`（預設，Google AI Studio 免費 tier）或 `vertex`（Vertex AI，走 IAM、要錢、資料不被訓練）。二者共用 `google.golang.org/genai` SDK，切換只改 `ClientConfig.Backend`。
* 模型：預設 `gemini-2.5-flash-lite`（`config.GeminiModel` / env `GEMINI_MODEL` 可覆寫；舊 env `VERTEX_MODEL` 仍有 fallback）。
* `temperature = 0`、`responseMimeType = application/json`，強制結構化輸出。
* Prompt 已內建「滾輪規則」；改 prompt 要小心一致性。
* 圖片來源：擇一 `imageBase64` 或 `imageUrl`（`gs://`）。不論 backend，`gs://` 都會先透過 Storage client 下載成 bytes 再送出（Gemini Developer API 不能直接讀 GCS）。
* 失敗回 `errors.ocr.upstream_failed`（`502`），不要把 Gemini 內部錯誤直接洩漏。

## Cloud Storage

* Bucket：`config.MetersBucket`（例：`wattrent-meters-staging`）。
* 物件路徑：`users/{uid}/bills/{billId}.{jpg|png|webp}`。
* 對外存取：後端發 V4 signed URL（PUT 15min；GET 1h）。
* 簽名要求 SA 有 `roles/iam.serviceAccountTokenCreator on self`（Terraform 已設）。
* **禁止**把 bucket 設成 public；`uniform_bucket_level_access` + `public_access_prevention=enforced`。

## 環境變數

| Name | 必填 | 用途 |
| --- | --- | --- |
| `APP_ENV` | – | dev / staging / production |
| `GCP_PROJECT_ID` | ✅ | Firestore / Storage（以及 AI_BACKEND=vertex 時 Vertex AI） |
| `GCP_REGION` | – | 預設 `asia-east1` |
| `METERS_BUCKET` | ✅ | GCS bucket 名稱 |
| `PORT` | – | 預設 8080；Cloud Run 自動帶 |
| `ALLOWED_ORIGINS` | – | CORS 白名單；production 不可 `*` |
| `AUTH_BYPASS` | – | 本地開發跳過 token 驗證；production 強制 false |
| `AUTH_BYPASS_UID` | – | bypass 時用的假 uid |
| `AI_BACKEND` | – | `gemini`（預設）或 `vertex` |
| `GEMINI_API_KEY` | ✅¹ | `AI_BACKEND=gemini` 時必填；從 <https://aistudio.google.com/apikey> 取得 |
| `GEMINI_MODEL` | – | 預設 `gemini-2.5-flash-lite`；舊 `VERTEX_MODEL` 仍為 fallback |
| `SENTRY_DSN` | – | 可選 |

¹ production 加 `AI_BACKEND=gemini` 未帶 `GEMINI_API_KEY` 會被 `config.Load` 拒絕。

新增環境變數 → 同時更新：
1. `internal/config/config.go`
2. `backend/.env.example`
3. `terraform/modules/api/main.tf` 的 Cloud Run env block
4. `.github/workflows/backend-deploy.yml`（若 CI 需要）

## 不要做的事

* ❌ 在原始碼寫死 secret / API key / project ID（用 `config.Load`）。
* ❌ 在 service / handler 直接讀 `os.Getenv`（透過 `config`）。
* ❌ 在 handler 信任 client 傳的 `userId`（用 `middleware.GetUID(c)`）。
* ❌ 在後端組面向使用者的中文 / 英文字串（i18n key 即可）。
* ❌ 用 `panic` / `log.Fatal` 結束請求。
* ❌ 用 `rand.Seed`（Go 1.20+ 已 deprecated）。
* ❌ 在 service 層直接 `c.JSON(...)`；service 只回 `(result, error)`。
* ❌ 直接刪 / 改 `models.UserSettings` / `models.Bill` 的 firestore tag（會破壞既有資料）。
* ❌ 在 production 開啟 `AUTH_BYPASS` 或 CORS `*`。
* ❌ 把 GCS bucket 設成 public，或在後端 return 原始 `gs://` 路徑給前端去 fetch（要簽 URL）。

## 啟動 / 測試

```powershell
cd backend
copy .env.example .env       # 第一次
go mod download
go run .                     # 本地直跑
# 或 air 熱重載（.air.toml）
air
```

```powershell
# 健康檢查
curl http://localhost:8080/health
curl http://localhost:8080/api/v1/health
```

```powershell
# 測試
go test -race ./...
go vet ./...
gofmt -l .
```

## 部署

* CI：[.github/workflows/backend-deploy.yml](../workflows/backend-deploy.yml)
* 流程：push to main → build distroless image → push Artifact Registry → `gcloud run deploy`
* 認證：Workload Identity Federation（OIDC），無 long-lived key
* 健康檢查：`/health` 回 200 才算成功
