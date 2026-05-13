---
applyTo: "frontend/**"
description: "WattRent 前端（Expo / React Native + NativeWind + Firebase Auth + i18n）開發規範"
---

# 前端 — Expo / React Native 指南

> 此規則自動套用在 `frontend/**` 之下的所有檔案。

## 技術堆疊

| 項目 | 版本 / 套件 |
| --- | --- |
| 框架 | **Expo SDK 53** + React Native 0.79 + React 19 |
| 路由 | `expo-router` 5.x（檔案式 + Typed Routes） |
| 樣式 | `nativewind` 4 + `tailwindcss` 3.4，主題色用 CSS 變數 |
| 多語系 | `i18next` 25 + `react-i18next` + `expo-localization` |
| 影像 | `expo-camera` 16、`expo-image-picker` 16 |
| 本地儲存 | `@react-native-async-storage/async-storage` |
| 圖示 | `@expo/vector-icons`（**只用 Ionicons**） |
| Auth | Firebase Auth Web SDK（搭配後端 ID token 驗證） |
| OTA | EAS Update |
| Build | EAS Build |
| Lint | `expo lint` |
| TS Path | `@/*` 與 `~/*` 都對應 `frontend/wattrent/*` |

## 目錄

```
frontend/wattrent/
├── app.config.js          ⚠️ 真正的 Expo 設定（app.json 過時，不要編輯）
├── app/
│   ├── _layout.tsx        根 layout：載字型 → initI18n → SplashScreen.hide
│   └── (tabs)/
│       ├── _layout.tsx    底部 4 個 Tab
│       ├── index.tsx      首頁
│       ├── capture.tsx    相機 + ImagePicker + OCR + 表單 + 送單
│       ├── history.tsx    帳單列表
│       └── settings.tsx   預設值 / 語言 / 通知
├── components/
│   ├── Dropdown.tsx
│   ├── PaymentStatusDropdown.tsx
│   └── nativewindui/Text.tsx
├── hooks/useTranslation.ts
├── lib/
│   ├── i18n.ts            i18n 初始化、語言切換
│   ├── cn.ts              clsx + tailwind-merge
│   └── useColorScheme.ts
├── locales/{en,zh-TW}.json
├── services/
│   ├── api.ts             fetch 包裝（OCR / Bills / Uploads）
│   └── settings.ts        Settings CRUD
├── types/index.ts
└── tailwind.config.js
```

## 後端 API 對接（已切換到 Cloud Run）

* Base URL：`process.env.EXPO_PUBLIC_API_URL`，例：`https://api.wattrent.app/api/v1`。
* 認證：每個 request 必須帶 `Authorization: Bearer <Firebase ID token>`。
* 取得 token：`auth.currentUser.getIdToken()`；快過期時 SDK 自動 refresh。
* 路徑變化（vs 舊版）：
  * 不再有 `?userId=...` query；後端從 token 拿 uid
  * `PATCH /settings/:userId` → `PATCH /settings`
  * `PUT /bills/:id/payment` body 改 `{ paid: true|false }`
  * 新增 `POST /uploads/sign`：先拿 signed URL，再 PUT 圖片到 GCS
* 回傳的 `Error` / `Message` 是 i18n key，要 `t(message)` 才顯示。

### 上傳電表照片新流程

```ts
// 1. 跟後端要 signed URL
const sign = await apiService.signUpload({ billId, contentType: 'image/jpeg' });

// 2. PUT 圖片到 GCS
await fetch(sign.uploadUrl, {
  method: 'PUT',
  headers: { 'Content-Type': 'image/jpeg' },
  body: imageBlob,
});

// 3. 建 bill 時帶 imageUrl = sign.gcsPath（gs://...）
await apiService.createBill({ ..., imageUrl: sign.gcsPath });
```

不要再把 base64 圖片塞進 bill body；後端只存 `gs://` 路徑。

## 慣例

### 路由
* expo-router 檔案式 + Typed Routes（`experiments.typedRoutes: true`）。
* 跳頁：`useRouter().push('/(tabs)/capture')`。
* Tab 設定集中在 `app/(tabs)/_layout.tsx`。

### i18n（**所有 user-facing 字串必走 i18n**）

```tsx
import { useTranslation } from '@/hooks/useTranslation';
const { t } = useTranslation();
<Text>{t('home.title')}</Text>
```

* 加新文字 → 同時更新 `locales/en.json` 與 `locales/zh-TW.json`。
* 鍵命名：`namespace.camelCase`（例：`history.markAsPaid`）。
* 動態插值：`t('history.billMessage', { rent: 8000 })`。
* 後端錯誤訊息也是 key：`t(response.error)` / `t(response.message)`。
* **禁止**把使用者可見字串硬寫在 JSX / Alert.alert。

### 樣式（NativeWind）

```tsx
<View className="bg-card rounded-2xl p-5 border border-border">
  <Text className="text-foreground text-lg font-semibold">...</Text>
</View>
```

* 顏色語意 token：`bg-background`、`bg-card`、`text-foreground`、`text-muted-foreground`、`border-border`、`bg-primary`、`text-destructive`...
* 不寫 raw hex（除非是 Ionicons `color` prop）；用 `useColorScheme().isDarkColorScheme`。
* Padding / radius 偏好 `p-5` / `rounded-2xl`。

### 元件
* 函數式 + Hooks，不寫 class component。
* 共用 UI 放 `components/`；`@` 與 `~` alias 任選一致即可（新檔優先 `@/`）。

### 服務層
* 對後端的呼叫**只走 `services/api.ts`**，不要在元件裡直接 `fetch`。
* 新 endpoint：在 `api.ts` 加 method、`types/index.ts` 補介面。
* 錯誤：`Alert.alert(t('common.error'), t(err.message ?? 'errors.unknown'))`。

### 平台
* `Platform.select` / `Platform.OS` 處理 iOS / Android / Web 差異。
* Camera permission：先 `useCameraPermissions()` 檢查再渲染。
* 切換頁面 focus 重設 `isCameraReady`。

## 不要做的事

* ❌ 把 API URL 硬編在元件裡（用 `services/api.ts` 的 base URL）。
* ❌ 編輯 `app.json`（改 `app.config.js`）。
* ❌ 編輯 `expo-env.d.ts`。
* ❌ 安裝大型 UI 套件（`react-native-paper`、`gluestack-ui` 等），用 NativeWind 自組。
* ❌ 引入第二個 icon library，只用 `Ionicons`。
* ❌ 硬編 user-facing 字串（必走 i18n）。
* ❌ 元件直接 `import AsyncStorage`，請透過 `services/` 或 `lib/` 包裝。
* ❌ 把 Firebase API key 以外的 secret 放進 `EXPO_PUBLIC_*`（會被 bundle 進 client）。
  * Firebase web config 公開沒關係，受 Firestore rules + Auth 保護。
  * 任何後端 API key、service account、Sentry auth token 等 → 不要進前端。
* ❌ 把舊的 `192.168.0.172` / ngrok URL 寫進新檔案。

## 啟動

```powershell
cd frontend\wattrent
npm install
npx expo start --web         # web
npx expo start --tunnel      # 實機 + Expo Go
```

或從根目錄：

```powershell
just frontend-web
just frontend
```

## 環境變數

| 變數 | 用途 |
| --- | --- |
| `EXPO_PUBLIC_API_URL` | API base URL（例：`https://api.wattrent.app/api/v1`） |
| `EXPO_PUBLIC_FIREBASE_API_KEY` | Firebase Auth web config |
| `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN` | – |
| `EXPO_PUBLIC_FIREBASE_PROJECT_ID` | – |
| `EXPO_PUBLIC_FIREBASE_APP_ID` | – |
| `EXPO_PUBLIC_SENTRY_DSN` | 可選 |

> Expo 規定 `EXPO_PUBLIC_` 前綴才會 bundling 到 client。**不要**用此前綴放敏感資料。

## 部署

* OTA（JS only）：[.github/workflows/frontend-update.yml](../workflows/frontend-update.yml)，push to main 自動跑 EAS Update。
* Native build：[.github/workflows/frontend-build.yml](../workflows/frontend-build.yml)，手動 trigger（升 SDK / 改 native module / 送 store 才用）。
