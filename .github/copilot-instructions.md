# WattRent — Copilot / Agent 全域指南

此檔案會在所有對話中自動載入，提供整個 repo 的高層認知。
**範圍特定**（前端、後端、infra）規則請見 [`.github/instructions/`](./instructions/) 目錄，會依檔案路徑自動套用。

---

## 一句話描述

WattRent 是一支 **Expo / React Native** 行動 App（iOS / Android / Web），搭配 **Go + Gin** REST API，幫租戶「拍電表 → 算電費 → 通知房東」。整體跑在 **GCP（Cloud Run + Firestore + Cloud Storage）**，OCR 預設走 **Google AI Studio Gemini API**（免費 tier），可透過 `AI_BACKEND=vertex` 切回 Vertex AI。

## 倉庫結構

```
wattrent/
├── backend/                    ← Go 1.25 + Gin（部署 Cloud Run）
│   ├── main.go                  程式入口（含 graceful shutdown）
│   ├── Dockerfile               distroless multi-stage build
│   ├── .env.example             本地開發環境變數樣板
│   └── internal/
│       ├── config/              os.Getenv 集中讀取
│       ├── clients/             Firebase Auth / Firestore / GCS / Gemini（AI Studio 或 Vertex）
│       ├── handlers/            HTTP handler，呼叫 service
│       ├── services/            業務邏輯（Firestore / Storage / OCR）
│       ├── models/              資料結構（含 firestore tag）
│       └── middleware/          CORS、Auth、ErrorHandler
│
├── firestore/                  ← Firestore rules + indexes（給 firebase deploy）
│   ├── firestore.rules
│   └── firestore.indexes.json
├── firebase.json               讓 firebase CLI 找上面兩個檔
│
├── terraform/                  ← IaC（HCP Terraform Cloud + GCP + Cloudflare + Sentry）
│   ├── main.tf / providers.tf / locals.tf / outputs.tf …
│   ├── envs/{staging,production}.tfvars
│   └── modules/
│       ├── project_services/   啟用 GCP API
│       ├── api/                Cloud Run + SA + Artifact Registry
│       ├── database/           Firestore database
│       ├── storage/            GCS bucket（電表照片）
│       ├── auth/               Identity Platform
│       ├── cicd/               GitHub Actions WIF
│       ├── dns/                Cloudflare records
│       └── observability/      Sentry
│
├── frontend/wattrent/          ← Expo SDK 55 + React Native 0.83 + React 19
│   ├── app/                     expo-router 檔案式路由
│   ├── components/              共用元件
│   ├── services/                api.ts / settings.ts
│   ├── lib/                     i18n、cn、useColorScheme
│   ├── locales/{en,zh-TW}.json
│   └── app.config.js            ⚠️ 真正的 Expo config（app.json 過時）
│
├── .github/
│   ├── copilot-instructions.md  本檔
│   ├── instructions/            scope-specific 規則
│   └── workflows/               CI / deploy / infra / security
│
├── docs/系統分析與意見回饋.md
├── docs/firestore-schema.md     Firestore schema 設計
├── Dockerfile                   舊的開發容器（漸退場）
├── Makefile / justfile          一鍵啟動（justfile 為主）
└── README.md
```

## 開發環境

* OS：**Windows 11**
* Shell：**PowerShell**（指令請用 `;` 串接，**不要用 `&&`**）
* 字符編碼：UTF-8（確保中文不變亂碼）
* Cloud CLI：`gcloud`、`firebase`、`terraform`、`eas`

## 啟動方式

```powershell
# 一次裝好所有相依
just install

# 後端（Cloud Run 本地模擬：Air 熱重載）
just backend          # → http://localhost:8080
# 本地 dev 預設 AUTH_BYPASS=true，使用假 uid

# 前端
just frontend-web     # web → http://localhost:8081
just frontend         # tunnel 模式給實機 Expo Go 掃描
```

> 沒有 `just` 也可改用 `make` 或直接 `cd backend && air` / `cd frontend/wattrent && npx expo start`。

## 部署架構

| 層級 | 服務 |
| --- | --- |
| 後端 | Cloud Run（asia-east1） |
| DB | Firestore Native Mode（asia-east1） |
| 物件儲存 | GCS（電表照片，single-region asia-east1） |
| OCR | Gemini 2.5 Flash-Lite（預設走 Google AI Studio 免費 tier；`AI_BACKEND=vertex` 切回 Vertex AI） |
| Auth | Identity Platform / Firebase Auth |
| DNS / CDN | Cloudflare |
| Secret | GCP Secret Manager（注入 Cloud Run env） |
| IaC | Terraform（state on HCP Terraform Cloud） |
| CI/CD | GitHub Actions + Workload Identity Federation（無 long-lived key） |
| 觀測 | Sentry（前後端） + Cloud Logging |

詳見：[docs/firestore-schema.md](../docs/firestore-schema.md)、[terraform/README.md](../terraform/README.md)、[.github/workflows/README.md](./workflows/README.md)

## 共通規範

### 語言 / i18n
* **前端**：所有 user-facing 字串走 i18n（`locales/en.json`、`locales/zh-TW.json`）。
* **後端**：禁止產生 user-facing 字串。`ApiResponse.Error` / `Message` 一律存 **i18n key**（例：`bills.created`、`errors.bill.not_found`），由前端 `t()` 翻譯。

### API 規範
* 所有路徑在 `/api/v1/` 之下。
* RESTful，複數資源名詞（`/bills`、`/settings`、`/uploads`、`/ocr`）。
* 統一回應：`models.ApiResponse{Success, Data, Error, Message}`。
* 時間：JSON 用 RFC3339 字串。
* 金錢 / 數量：`float64` ↔ `number`。
* 認證：除了 `/health`，全部 endpoint 都需要 `Authorization: Bearer <Firebase ID token>`。

### 安全
* **絕對禁止**把 secret / API key 寫進原始碼，一律走環境變數 + Secret Manager。
* 後端不可信任 client 傳來的 `userId`，**永遠**從 verified ID token 拿（`middleware.GetUID(c)`）。
* GCS object 不允許 public read；前端用後端發的 V4 signed URL（15 min for upload, 1h for read）。
* CORS：`production` 強制白名單，禁用 `*`。

### 部署 / IaC
* 所有 GCP 資源都靠 Terraform 管理，**不要在 console 手動點**（除非是 bootstrap 步驟）。
* GitHub Actions 走 OIDC（Workload Identity Federation），repo 不放 long-lived GCP key。
* Cloud Run image tag 由 CI 推；Terraform 用 `lifecycle.ignore_changes` 避免互踩。

## 工具偏好

* 後端：`go mod`（不要混 vendor）；lint = `gofmt` + `go vet`；測試 = `testing` + table-driven。
* 前端：`npm`（不要混 yarn / pnpm）；lint = `expo lint`；測試（未實作）= Jest。
* IaC：`terraform fmt -recursive` + `terraform validate`。
* 容器：multi-stage + distroless，不要 push 開發 image 到 production registry。

## 已知遺留問題

1. ~~`backend/main.oldgo` 副檔名錯誤~~ → 已重寫 `backend/main.go`。
2. ~~`ImageAnalysisQuickstart.go` 含外洩 Azure key~~ → 已刪除。**請仍到 Azure portal 撤銷該金鑰**（git history 還在）。
3. ~~後端資料只在記憶體~~ → 已改 Firestore。
4. ~~沒有認證（hardcoded user1）~~ → 已接 Firebase Auth；本地開發走 `AUTH_BYPASS=true`。
5. ~~OCR 是假的~~ → 後端已串 Gemini（預設 AI Studio API，用 `google.golang.org/genai` unified SDK）；前端 `capture.tsx` 仍須改呼叫 `apiService.processImage()`。
6. 硬編碼的 `192.168.0.172` / `ngrok` URL 仍散在前端，待清。
7. `app.json` / `app.config.js` 共存，待二擇一。
8. 沒有測試覆蓋率。

## 文件規範

* 修改架構 / 部署 / 雲端服務時，請同步更新 [docs/系統分析與意見回饋.md](../docs/系統分析與意見回饋.md) 與 [docs/firestore-schema.md](../docs/firestore-schema.md)。
* 不要在沒被要求的情況下大量新增 markdown 檔。
