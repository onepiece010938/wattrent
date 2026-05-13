# WattRent — 電費房租計算助手

WattRent 是一支幫租戶「拍電表 → 算電費 → 通知房東」的行動 App。
跨 **iOS / Android / Web** 同一份 Expo 專案，後端跑在 **GCP Cloud Run**。

## 功能特色

- 📸 **電表拍照識別**：用 Gemini 視覺模型自動讀電表度數
- 💰 **自動計算電費**：依度數 × 電費單價算當月電費
- 🏠 **房租整合**：電費＋房租一起算，產出付款訊息
- 📊 **歷史記錄**：過往帳單一覽，標記匯款狀態
- 🌐 **跨平台 + i18n**：iOS / Android / Web，支援繁中、英文
- 🔐 **Firebase Auth**：後端用 ID token 驗證，前端整合中

## 技術架構

### 前端（[`frontend/wattrent/`](frontend/wattrent/)）
- **框架**：Expo SDK **55** + React Native **0.83** + React **19.2**
- **語言**：TypeScript 5.9
- **路由**：`expo-router` 5.x（檔案式 + Typed Routes）
- **樣式**：NativeWind 4 + tailwindcss 3.4
- **動畫**：Reanimated 4 + `react-native-worklets`
- **多語系**：`i18next` + `react-i18next` + `expo-localization`
- **本地儲存**：`@react-native-async-storage/async-storage`
- **OTA**：EAS Update（`expo-updates` ~55）

### 後端（[`backend/`](backend/)）
- **語言**：Go **1.25**（Dockerfile 走 `golang:1.25-alpine` 浮動 tag）
- **框架**：Gin v1.12
- **資料庫**：Firestore Native（asia-east1）
- **物件儲存**：Cloud Storage（V4 signed URL）
- **OCR**：Google AI Studio Gemini API（預設、免費 tier）；
  `AI_BACKEND=vertex` 可切回 Vertex AI（要錢、走 IAM）
- **Auth**：Firebase Admin SDK（`firebase.google.com/go/v4`）
- **Gemini SDK**：`google.golang.org/genai`（unified SDK，兩個 backend 共用）

### 雲端 / IaC（[`terraform/`](terraform/)）
- **Compute**：Cloud Run（asia-east1, scale-to-zero）
- **DNS / CDN**：Cloudflare
- **Secret**：GCP Secret Manager（注入 Cloud Run env）
- **IaC**：Terraform + HCP Terraform Cloud
- **CI/CD**：GitHub Actions + Workload Identity Federation（無長效金鑰）
- **觀測**：Sentry + Cloud Logging
- **成本護欄**：Cloud Billing Budget + Pub/Sub + Cloud Function 自動 kill switch

## 快速開始

### 一鍵啟動（用 [`just`](https://github.com/casey/just)）

```powershell
just install      # 第一次：裝前後端依賴
just backend      # 後端熱重載 → http://localhost:8080
just frontend-web # 前端 web → http://localhost:8081
just frontend     # 前端 tunnel 給實機 Expo Go
```

> 沒有 `just` 也可改用 `make`，或：
> - 後端：`cd backend; copy .env.example .env; air`（沒裝 air 就 `go run .`）
> - 前端：`cd frontend/wattrent; npm install; npx expo start`

### 後端 .env

複製 [`backend/.env.example`](backend/.env.example) 成 `backend/.env`，重點：
- `AUTH_BYPASS=true` 跳過 Firebase ID token 驗證（本地開發用）
- `AI_BACKEND=gemini`（預設）+ `GEMINI_API_KEY=...`（從 <https://aistudio.google.com/apikey> 拿）
- 或設 `AI_BACKEND=vertex` 走 Vertex AI（要 `gcloud auth application-default login`）

## 主要 API 端點

| Method | Path | 說明 |
| --- | --- | --- |
| GET  | `/api/v1/health` | 健康檢查（公開） |
| POST | `/api/v1/uploads/signed-url` | 取 V4 PUT signed URL（15 min） |
| POST | `/api/v1/ocr/process` | 送圖（base64 或 `gs://`）→ Gemini → 度數 |
| POST | `/api/v1/bills` | 建帳單 |
| GET  | `/api/v1/bills` | 列出本人帳單 |
| GET  | `/api/v1/bills/latest` | 最新一筆 |
| GET  | `/api/v1/bills/:id` | 單筆 |
| PUT  | `/api/v1/bills/:id` | 更新 |
| PUT  | `/api/v1/bills/:id/payment` | 標記付款狀態 |
| DELETE | `/api/v1/bills/:id` | 刪除 |
| GET / PUT | `/api/v1/settings` | 個人預設值 |

> 除了 `/health`，全部 endpoint 都要帶 `Authorization: Bearer <Firebase ID token>`。

## 專案結構

```
wattrent/
├── backend/                    Go 1.25 + Gin（Cloud Run）
│   ├── main.go                 程式入口（含 graceful shutdown）
│   ├── Dockerfile              multi-stage + distroless
│   ├── .env.example            環境變數樣板
│   └── internal/
│       ├── config/             環境變數集中載入
│       ├── clients/            Firestore / Storage / Gemini / Firebase Auth
│       ├── handlers/           HTTP handler
│       ├── services/           bill / settings / storage / ocr
│       ├── models/             資料結構
│       └── middleware/         Auth / CORS / ErrorHandler
│
├── firestore/                  Firestore rules + indexes
├── frontend/wattrent/          Expo SDK 55 + React Native 0.83
├── terraform/                  IaC（GCP + Cloudflare + Sentry）
├── docs/                       系統分析、Firestore schema
├── .github/                    Copilot instructions + workflows
├── Dockerfile                  舊的開發容器（漸退場）
├── Makefile / justfile         一鍵啟動
└── README.md
```

## 開發注意事項

1. **Windows 開發環境**：PowerShell；指令用 `;` 串接，**不要用 `&&`**
2. **跨平台相容**：留意 Windows ↔ macOS / Linux 行尾差異（已用 `.gitattributes` 強制 LF）
3. **環境變數**：前端 API URL 可透過 `EXPO_PUBLIC_API_URL` 設定
4. **i18n**：所有 user-facing 字串走 i18n key（後端只丟 key，前端做翻譯）
5. **Secret 安全**：絕對禁止把 secret / API key 寫進原始碼，一律走環境變數 + Secret Manager

## 詳細文件

- [docs/系統分析與意見回饋.md](docs/系統分析與意見回饋.md) — 完整架構、成本、決策記錄
- [docs/firestore-schema.md](docs/firestore-schema.md) — Firestore schema 設計
- [terraform/README.md](terraform/README.md) — IaC bootstrap 與部署
- [.github/copilot-instructions.md](.github/copilot-instructions.md) — AI 助手規範
- [.github/workflows/README.md](.github/workflows/README.md) — CI/CD workflow 一覽

## 待辦

- [ ] 前端 `capture.tsx` 改呼叫真的 `apiService.processImage()`（目前是 mock）
- [ ] 前端整合 Firebase Auth Web SDK，前後端打通 token 驗證
- [ ] 清掉前端散落的 `192.168.x.x` / `ngrok` 寫死 URL
- [ ] `app.json` / `app.config.js` 二擇一
- [ ] 加測試覆蓋

## 授權

MIT License
