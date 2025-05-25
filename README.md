# WattRent - 電費房租計算助手

WattRent 是一個幫助租戶計算電費和房租的行動應用程式。用戶可以透過拍照或上傳電表照片，自動識別電表度數，計算電費並生成付款通知訊息。

## 功能特色

- 📸 **電表拍照識別**：使用 OCR 技術自動識別電表度數
- 💰 **自動計算電費**：根據用電度數和電費單價計算當月電費
- 🏠 **房租管理**：整合房租計算，一次搞定所有費用
- 📊 **歷史記錄**：查看過往的電費和房租記錄
- 📤 **付款通知**：自動生成付款訊息，方便通知房東
- 📱 **跨平台支援**：支援 iOS、Android 和 Web 平台

## 技術架構

### 前端
- **框架**: Expo SDK 51 + React Native
- **語言**: TypeScript
- **路由**: Expo Router
- **UI**: React Native 原生元件
- **相機**: expo-camera
- **本地儲存**: AsyncStorage

### 後端
- **語言**: Go 1.21+
- **框架**: Gin Web Framework
- **資料庫**: AWS DynamoDB (計劃中)
- **部署**: AWS Lambda + API Gateway (計劃中)
- **OCR**: 模擬實作（未來整合 AWS Textract 或 Google Vision API）

## 快速開始

### 前端開發

```bash
cd frontend/wattrent
npm install
npx expo start
```

支援的執行方式：
- 按 `w` 在瀏覽器開啟
- 按 `a` 在 Android 模擬器開啟
- 按 `i` 在 iOS 模擬器開啟（需要 macOS）
- 使用 Expo Go App 掃描 QR Code 在實機測試

### 後端開發

```bash
cd backend
go mod download
air
```

後端將在 `http://localhost:8080` 啟動，API 基礎路徑為 `/api/v1`

## API 端點

### OCR
- `POST /api/v1/ocr/process` - 處理影像並識別電表度數

### 帳單
- `POST /api/v1/bills` - 建立新帳單
- `GET /api/v1/bills` - 獲取所有帳單
- `GET /api/v1/bills/latest` - 獲取最新帳單
- `GET /api/v1/bills/:id` - 獲取特定帳單
- `PUT /api/v1/bills/:id/payment` - 更新付款狀態

## 專案結構

```
wattrent/
├── frontend/
│   └── wattrent/
│       ├── app/              # Expo Router 頁面
│       ├── components/       # 可重用元件
│       ├── services/        # API 和儲存服務
│       ├── types/           # TypeScript 型別定義
│       └── constants/       # 常數配置
├── backend/
│   ├── internal/
│   │   ├── handlers/        # HTTP 處理器
│   │   ├── models/         # 資料模型
│   │   ├── services/       # 業務邏輯
│   │   └── middleware/     # 中間件
│   └── main.go             # 應用程式入口
├── .cursorignore           # Cursor IDE 忽略設定
└── .cursorrules           # Cursor IDE 開發規範
```

## 開發注意事項

1. **Windows 開發環境**：專案在 Windows 11 上開發，使用 PowerShell
2. **跨平台相容**：確保程式碼在不同平台上都能正常運作
3. **本地開發**：前端使用 Expo 開發伺服器，後端使用 Air 熱重載
4. **環境變數**：前端 API URL 可透過 `EXPO_PUBLIC_API_URL` 環境變數設定

## 未來計劃

- [ ] 整合真實的 OCR 服務（AWS Textract 或 Google Vision API）
- [ ] 實作用戶認證系統
- [ ] 部署到 AWS Lambda + DynamoDB
- [ ] 添加更多統計圖表功能
- [ ] 支援多語言
- [ ] 添加推播通知功能

## 貢獻指南

歡迎提交 Issue 和 Pull Request！

## 授權

MIT License
