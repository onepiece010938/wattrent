---
applyTo: "frontend/**"
description: "WattRent frontend (Expo / React Native + NativeWind + Firebase Auth + i18n) development guide"
---

# Frontend — Expo / React Native guide

> These rules auto-apply to every file under `frontend/**`.

## Tech stack

| Item | Version / package |
| --- | --- |
| Framework | **Expo SDK 55** + React Native 0.83 + React 19.2 |
| Routing | `expo-router` 5.x (SDK 55 channel; file-based + Typed Routes) |
| Styling | `nativewind` 4 + `tailwindcss` 3.4; theme colors via CSS variables |
| Animation | `react-native-reanimated` 4 + `react-native-worklets` (split out in SDK 55) |
| i18n | `i18next` 25 + `react-i18next` + `expo-localization` |
| Imaging | `expo-camera` ~55, `expo-image-picker` ~55 |
| Local storage | `@react-native-async-storage/async-storage` 2.2 |
| Icons | `@expo/vector-icons` 15 (**Ionicons only**) |
| Auth | Firebase Auth Web SDK (paired with backend ID-token verification) |
| OTA | EAS Update (`expo-updates` ~55) |
| Build | EAS Build |
| Lint | `expo lint` (`eslint-config-expo` ~55) |
| TS path aliases | `@/*` and `~/*` both map to `frontend/wattrent/*` |

## Layout

```
frontend/wattrent/
├── app.config.js          ⚠️ The real Expo config (app.json is legacy; do not edit)
├── app/
│   ├── _layout.tsx        Root layout: load fonts → initI18n → SplashScreen.hide
│   └── (tabs)/
│       ├── _layout.tsx    The four bottom tabs
│       ├── index.tsx      Home
│       ├── capture.tsx    Camera + ImagePicker + OCR + form + submit
│       ├── history.tsx    Bill list
│       └── settings.tsx   Defaults / language / notifications
├── components/
│   ├── Dropdown.tsx
│   ├── PaymentStatusDropdown.tsx
│   └── nativewindui/Text.tsx
├── hooks/useTranslation.ts
├── lib/
│   ├── i18n.ts            i18n init + language switching
│   ├── cn.ts              clsx + tailwind-merge
│   └── useColorScheme.ts
├── locales/{en,zh-TW}.json
├── services/
│   ├── api.ts             fetch wrapper (OCR / Bills / Uploads)
│   └── settings.ts        Settings CRUD
├── types/index.ts
└── tailwind.config.js
```

## Talking to the backend (now on Cloud Run)

* Base URL: `process.env.EXPO_PUBLIC_API_URL`, e.g. `https://api.wattrent.app/api/v1`.
* Auth: every request must carry `Authorization: Bearer <Firebase ID token>`.
* Token: `auth.currentUser.getIdToken()`; the SDK refreshes it automatically as it nears expiry.
* Path changes (vs the old version):
  * `?userId=...` query strings are gone; the backend reads uid from the token
  * `PATCH /settings/:userId` → `PATCH /settings`
  * `PUT /bills/:id/payment` body is now `{ paid: true|false }`
  * New `POST /uploads/sign`: get a signed URL first, then PUT the image to GCS
* The `Error` / `Message` fields in the response are i18n keys; pipe them through `t(message)` before display.

### New meter-photo upload flow

```ts
// 1. Ask the backend for a signed URL
const sign = await apiService.signUpload({ billId, contentType: 'image/jpeg' });

// 2. PUT the image to GCS
await fetch(sign.uploadUrl, {
  method: 'PUT',
  headers: { 'Content-Type': 'image/jpeg' },
  body: imageBlob,
});

// 3. Pass imageUrl = sign.gcsPath (gs://...) when creating the bill
await apiService.createBill({ ..., imageUrl: sign.gcsPath });
```

Stop stuffing base64 images into the bill body; the backend only stores the `gs://` path.

## Conventions

### Routing
* expo-router file-based + Typed Routes (`experiments.typedRoutes: true`).
* Navigate with `useRouter().push('/(tabs)/capture')`.
* Tab config lives in `app/(tabs)/_layout.tsx`.

### i18n (**every user-facing string MUST go through i18n**)

```tsx
import { useTranslation } from '@/hooks/useTranslation';
const { t } = useTranslation();
<Text>{t('home.title')}</Text>
```

* Adding new copy → update both `locales/en.json` and `locales/zh-TW.json`.
* Key naming: `namespace.camelCase` (e.g. `history.markAsPaid`).
* Interpolation: `t('history.billMessage', { rent: 8000 })`.
* Backend error messages are also keys: `t(response.error)` / `t(response.message)`.
* **Never** hard-code user-facing copy in JSX or `Alert.alert`.

### Styling (NativeWind)

```tsx
<View className="bg-card rounded-2xl p-5 border border-border">
  <Text className="text-foreground text-lg font-semibold">...</Text>
</View>
```

* Semantic color tokens: `bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`, `bg-primary`, `text-destructive`...
* No raw hex (except for the Ionicons `color` prop); use `useColorScheme().isDarkColorScheme`.
* Padding / radius defaults: `p-5` / `rounded-2xl`.

### Components
* Function components + hooks; no class components.
* Shared UI lives in `components/`. Pick `@` or `~` consistently per file (prefer `@/` for new files).

### Service layer
* Backend calls go **only through `services/api.ts`**; never `fetch` directly from a component.
* New endpoint: add the method in `api.ts`, add the type in `types/index.ts`.
* Errors: `Alert.alert(t('common.error'), t(err.message ?? 'errors.unknown'))`.

### Platforms
* Use `Platform.select` / `Platform.OS` for iOS / Android / Web differences.
* Camera permission: check via `useCameraPermissions()` before rendering.
* Reset `isCameraReady` when the screen regains focus.

## Don't do this

* ❌ Hard-code the API URL in a component (use the base URL in `services/api.ts`).
* ❌ Edit `app.json` (edit `app.config.js`).
* ❌ Edit `expo-env.d.ts`.
* ❌ Install heavyweight UI libraries (`react-native-paper`, `gluestack-ui`, etc.); roll your own with NativeWind.
* ❌ Pull in a second icon library; only `Ionicons`.
* ❌ Hard-code user-facing copy (always go through i18n).
* ❌ `import AsyncStorage` directly in a component; wrap it in `services/` or `lib/`.
* ❌ Put any secret other than the public Firebase web API key into `EXPO_PUBLIC_*` (it gets bundled into the client).
  * The Firebase web config is fine to expose because Firestore rules + Auth protect it.
  * Backend API keys, service-account keys, Sentry auth tokens, etc. → must NOT enter the frontend.
* ❌ Write the legacy `192.168.0.172` / ngrok URLs into new files.

## Run

```powershell
cd frontend\wattrent
npm install
npx expo start --web         # web
npx expo start --tunnel      # real device + Expo Go
```

Or from the repo root:

```powershell
just frontend-web
just frontend
```

## Environment variables

| Variable | Purpose |
| --- | --- |
| `EXPO_PUBLIC_API_URL` | API base URL (e.g. `https://api.wattrent.app/api/v1`) |
| `EXPO_PUBLIC_FIREBASE_API_KEY` | Firebase Auth web config |
| `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN` | – |
| `EXPO_PUBLIC_FIREBASE_PROJECT_ID` | – |
| `EXPO_PUBLIC_FIREBASE_APP_ID` | – |
| `EXPO_PUBLIC_SENTRY_DSN` | Optional |

> Expo only bundles env vars prefixed with `EXPO_PUBLIC_` into the client. **Do not** put secrets behind that prefix.

## Deploy

* OTA (JS only): [.github/workflows/frontend-update.yml](../workflows/frontend-update.yml); push to main triggers EAS Update.
* Native build: [.github/workflows/frontend-build.yml](../workflows/frontend-build.yml); manually triggered (only when bumping the SDK, changing native modules, or shipping to a store).
