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

---

## 快速開始（Windows / PowerShell）

### 一次性準備（只做一次）

1. **裝 CLI 工具**（缺哪個裝哪個）

   ```powershell
   # 必要
   winget install GoLang.Go               # Go 1.25+
   winget install OpenJS.NodeJS.LTS       # Node 22 LTS
   winget install Casey.Just              # just（推薦，比 make 友善）
   winget install Google.CloudSDK         # gcloud（Firestore/GCS 用 ADC）
   go install github.com/air-verse/air@latest   # 後端熱重載

   # 選用
   winget install Hashicorp.Terraform     # 改 infra 時
   npm install -g firebase-tools          # 改 firestore rules 時
   choco install ngrok                    # 只有要把本機 backend 暴露外網才用
   ```

2. **登入 GCP** — 後端用 [Application Default Credentials](https://cloud.google.com/docs/authentication/provide-credentials-adc) 連 Firestore / Cloud Storage：

   ```powershell
   gcloud auth application-default login
   gcloud config set project wattrent-staging
   ```

3. **拿 Gemini API key** — 到 <https://aistudio.google.com/apikey> 申請（免費 tier，1500 RPD on flash-lite）。

4. **裝依賴 + 建 .env**

   ```powershell
   just bootstrap
   ```

   會做：
   - `go mod download`、`npm install`
   - 從 [`backend/.env.example`](backend/.env.example) 複製出 `backend/.env`（被 [`.gitignore`](.gitignore) 擋著，不會 commit）

5. **編輯 `backend/.env`**，至少填：

   ```env
   GEMINI_API_KEY=AIza...    # 上面拿到的
   ```

   其他預設值（`AUTH_BYPASS=true`、`GCP_PROJECT_ID=wattrent-staging` 等）開箱即用。

### 每次開發（兩個視窗）

```powershell
# 視窗 1：後端 → http://localhost:8080
just backend

# 視窗 2：前端
just frontend-web        # web → http://localhost:8081
# 或
just frontend-lan        # 同 WiFi 的手機掃 QR（推薦）
# 或
just frontend            # tunnel — 不同網路也能用，但較慢
```

> 沒有 `just` 也可以直接：
> - 後端：`cd backend; air`（要先手動 set 環境變數，或用 [direnv](https://direnv.net/)）
> - 前端：`cd frontend/wattrent; npx expo start`

---

## 用實機 Expo Go 測試

1. 手機裝 [Expo Go](https://expo.dev/go)
2. 跑 `just frontend-lan` （**手機 + 電腦在同一個 WiFi**）
3. Expo Dev Tools 會印一張 QR code → Android 直接掃，iOS 用相機掃
4. 前端會自動偵測 Metro 的 hostUri → backend 連 `http://<電腦 LAN IP>:8080/api/v1`，不必手動寫 IP（邏輯在 [`frontend/wattrent/lib/apiUrl.ts`](frontend/wattrent/lib/apiUrl.ts)）
5. 確認 Windows 防火牆放行 8080 + 8081（首次跑會跳對話框，按「允許」）

### 不在同 WiFi 怎麼辦？

| 情境 | 前端 | 後端 |
| --- | --- | --- |
| 手機 4G、電腦在家 | `just frontend`（tunnel） | 設 `EXPO_PUBLIC_API_URL` 指向 staging Cloud Run（見下） |
| 公司 WiFi 隔離了筆電 | 同上 | 同上 |
| 想驗證真的 staging 行為 | `just frontend-lan` | 設 `EXPO_PUBLIC_API_URL` |

切到 staging Cloud Run 不跑本機後端：

```powershell
$env:EXPO_PUBLIC_API_URL='https://wattrent-api-6aiyzfe65q-de.a.run.app/api/v1'
just frontend-lan
```

只想把本機 backend 暴露給外網（少見場景，例如測 webhook callback）：

```powershell
# 視窗 1
just backend
# 視窗 2
just backend-tunnel       # ngrok http 8080，會印一個 https://*.ngrok-free.app 給你
# 視窗 3：把 ngrok URL 給前端
$env:EXPO_PUBLIC_API_URL='https://你拿到的.ngrok-free.app/api/v1'
just frontend
```

---

## 本地後端用到哪些雲端服務？

| 服務 | 必要嗎 | 說明 | 可不可離線 |
| --- | --- | --- | --- |
| **Firestore**（asia-east1） | ✅ 必要 | 帳單 / 設定持久化 | 想完全離線可跑 [Firestore Emulator](https://firebase.google.com/docs/emulator-suite/install_and_configure)，但目前後端沒接 emulator 環境變數 |
| **Cloud Storage**（`wattrent-meters-staging`） | ✅ 必要 | 電表照片 + V4 signed URL | 同上，未接 emulator |
| **Google AI Studio Gemini API** | ⭕ 只有 OCR endpoint 需要 | `GEMINI_API_KEY` 缺 → backend 還是會起來，只有 `/api/v1/ocr/process` 回 503 | ✅ 不呼叫 OCR 就完全免錢免網 |
| **Firebase Auth** | ❌ 預設 bypass | `AUTH_BYPASS=true` 跳過 token 驗證，用假 uid `dev-user` | ✅ |
| **Vertex AI**（`AI_BACKEND=vertex` 才用） | ❌ | 走 IAM，要錢；資料不被訓練 | — |
| **Sentry** | ❌ | `SENTRY_DSN` 空字串就停用 | ✅ |

**結論**：本機開發最少只要「Gemini API key（如果要用 OCR）+ ADC（如果要存 Firestore/GCS）」。
都不想設？把 `AUTH_BYPASS=true`、`GCP_PROJECT_ID=` 留空、不呼叫 Firestore/GCS/OCR 端點，backend 還是能起 health check（不過會在第一次呼 firestore 時死）。完整離線開發要等 emulator 接起來。

---

## 後端環境變數對照

完整定義在 [`backend/internal/config/config.go`](backend/internal/config/config.go)，樣板在 [`backend/.env.example`](backend/.env.example)：

| 變數 | 預設 | 說明 |
| --- | --- | --- |
| `APP_ENV` | `dev` | `dev` / `staging` / `production` / `preview-{n}` |
| `GCP_PROJECT_ID` | _（必填，除非 `AUTH_BYPASS=true`）_ | Firestore / GCS / Vertex 共用 |
| `GCP_REGION` | `asia-east1` | |
| `METERS_BUCKET` | `wattrent-meters-staging` | 電表照片 GCS bucket |
| `PORT` | `8080` | Cloud Run 會自動帶 |
| `ALLOWED_ORIGINS` | `*` | 逗號分隔；production 強制不可 `*` |
| `AUTH_BYPASS` | `false` | `true` 跳過 ID token；production 強制 false |
| `AUTH_BYPASS_UID` | `dev-user` | bypass 模式下的假 uid |
| `AI_BACKEND` | `gemini` | `gemini`（AI Studio 免費 tier）或 `vertex`（要錢） |
| `GEMINI_API_KEY` | _（gemini backend 必填）_ | 從 <https://aistudio.google.com/apikey> 拿 |
| `GEMINI_MODEL` | `gemini-2.5-flash-lite` | |
| `SENTRY_DSN` | _（空＝停用）_ | |

production 的 fail-fast 規則（在 `config.Load`）：
- `AUTH_BYPASS=true` 直接拒
- `ALLOWED_ORIGINS=*` 直接拒
- `AI_BACKEND=gemini` 但 `GEMINI_API_KEY` 空 → 直接拒（dev/staging 則是 fail-late，OCR 才會 503）

---

## 主要 API 端點

| Method | Path | 說明 |
| --- | --- | --- |
| GET  | `/health` | 健康檢查（公開，無 `/api/v1` 前綴） |
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

> 除了 `/health`，全部 endpoint 都要帶 `Authorization: Bearer <Firebase ID token>`（`AUTH_BYPASS=true` 例外）。

## 部署狀態

| 環境 | 狀態 | URL |
| --- | --- | --- |
| Staging | ✅ 線上 | <https://wattrent-api-6aiyzfe65q-de.a.run.app> |
| Production | 🔒 暫時鎖住，發表 Play Store 前才開 | — |

CI/CD 全部走 GitHub Actions + WIF；deploy workflow 的 `production` 選項暫時被拿掉，詳見 [.github/workflows/README.md](.github/workflows/README.md)。

## 專案結構

```
wattrent/
├── backend/                    Go 1.25 + Gin（Cloud Run）
│   ├── main.go                 程式入口（含 graceful shutdown）
│   ├── Dockerfile              multi-stage + distroless
│   ├── .env.example            環境變數樣板
│   ├── .air.toml               air 熱重載設定
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
├── .github/                    Copilot instructions + workflows
├── Dockerfile                  舊的開發容器（漸退場）
├── justfile                    一鍵啟動（Windows / PowerShell；本專案唯一推薦）
└── README.md
```

> 過去同時維護 `Makefile` 與 `justfile`，現已收斂到 `justfile`。要回退跑 `git restore Makefile`。

## 開發注意事項

1. **Windows / PowerShell**：指令用 `;` 串接，**不要用 `&&`**
2. **跨平台行尾**：repo 用 [`.gitattributes`](.gitattributes) 強制 LF；Windows clone 後 git 自動轉換
3. **環境變數**：前端 API URL 透過 `EXPO_PUBLIC_API_URL` 覆寫；後端走 `backend/.env`
4. **i18n**：所有 user-facing 字串走 i18n key（後端只丟 key，前端做翻譯）
5. **Secret 安全**：絕對禁止把 secret / API key 寫進原始碼，一律走環境變數 + Secret Manager
6. **本機 Gemini key 不會自動寫進 Cloud Run** — staging/prod 走 GCP Secret Manager 注入，跟 `backend/.env` 完全獨立

## 常見問題

**Q1：`just backend` 卡在 `init firestore: ... projectID was empty` 怎麼辦？**
→ 沒跑 `just bootstrap`，或 `backend/.env` 裡 `GCP_PROJECT_ID` 是空的。預設 `wattrent-staging` 應該開箱即用。

**Q2：`init firestore: rpc error: code = PermissionDenied` 怎麼辦？**
→ 沒跑 `gcloud auth application-default login`，或登入的帳號對 `wattrent-staging` 沒有 Firestore 讀寫權限。

**Q3：呼叫 `/api/v1/ocr/process` 回 `503 ai service unavailable`？**
→ `backend/.env` 的 `GEMINI_API_KEY` 沒填。

**Q4：手機 Expo Go 連不到 backend？**
→ 確認手機跟電腦同 WiFi、Windows 防火牆放行 8080。或臨時切去 staging：`$env:EXPO_PUBLIC_API_URL='https://wattrent-api-6aiyzfe65q-de.a.run.app/api/v1'; just frontend-lan`

**Q5：要跟自己以外的人 demo？**
→ 別開本機後端，直接用 staging Cloud Run。前端跑 tunnel：`$env:EXPO_PUBLIC_API_URL='https://wattrent-api-6aiyzfe65q-de.a.run.app/api/v1'; just frontend`

## 詳細文件

- [terraform/README.md](terraform/README.md) — IaC bootstrap 與部署
- [.github/copilot-instructions.md](.github/copilot-instructions.md) — AI 助手規範
- [.github/workflows/README.md](.github/workflows/README.md) — CI/CD workflow 一覽

## 待辦

- [ ] 前端 `capture.tsx` 改呼叫真的 `apiService.processImage()`（目前是 mock）
- [ ] 前端整合 Firebase Auth Web SDK，前後端打通 token 驗證
- [ ] 清掉前端散落的 `192.168.x.x` / `ngrok` 寫死 URL
- [ ] `app.json` / `app.config.js` 二擇一
- [ ] 接 Firestore/Storage Emulator，做到完全離線開發
- [ ] 加測試覆蓋

## 授權

MIT License

