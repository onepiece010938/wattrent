# WattRent — electricity bill & rent helper

WattRent is a mobile app that helps tenants "snap the meter → compute the
bill → notify the landlord". One Expo project ships to **iOS / Android /
Web**, with the backend running on **GCP Cloud Run**.

## Features

- **Meter photo OCR** — Gemini vision model auto-reads the meter digits
- **Auto-compute electricity** — kWh × unit price for the month
- **Rent integration** — rolls electricity + rent into a single payment message
- **History** — past bills at a glance, with payment status flags
- **Cross-platform + i18n** — iOS / Android / Web; Traditional Chinese + English
- **Firebase Auth** — backend verifies ID tokens (frontend integration in progress)

## Stack

### Frontend ([`frontend/wattrent/`](frontend/wattrent/))
- **Framework**: Expo SDK **55** + React Native **0.83** + React **19.2**
- **Language**: TypeScript 5.9
- **Routing**: `expo-router` 5.x (file-based + Typed Routes)
- **Styling**: NativeWind 4 + tailwindcss 3.4
- **Animation**: Reanimated 4 + `react-native-worklets`
- **i18n**: `i18next` + `react-i18next` + `expo-localization`
- **Local storage**: `@react-native-async-storage/async-storage`
- **OTA**: EAS Update (`expo-updates` ~55)

### Backend ([`backend/`](backend/))
- **Language**: Go **1.25** (Dockerfile uses the `golang:1.25-alpine` floating tag)
- **Framework**: Gin v1.12
- **Database**: Firestore Native (asia-east1)
- **Object storage**: Cloud Storage (V4 signed URLs)
- **OCR**: Google AI Studio Gemini API (default, free tier);
  `AI_BACKEND=vertex` switches to Vertex AI (paid, IAM-based)
- **Auth**: Firebase Admin SDK (`firebase.google.com/go/v4`)
- **Gemini SDK**: `google.golang.org/genai` (unified SDK shared by both backends)

### Cloud / IaC ([`terraform/`](terraform/))
- **Compute**: Cloud Run (asia-east1, scale-to-zero)
- **DNS / CDN**: Cloudflare
- **Secrets**: GCP Secret Manager (injected as Cloud Run env)
- **IaC**: Terraform + HCP Terraform Cloud
- **CI/CD**: GitHub Actions + Workload Identity Federation (no long-lived keys)
- **Observability**: Sentry + Cloud Logging
- **Cost guardrails**: Cloud Billing Budget + Pub/Sub + Cloud Function kill switch

---

## Quickstart (Windows / PowerShell)

### One-time setup

1. **Install CLI tools** (skip whatever you already have):

   ```powershell
   # Required
   winget install GoLang.Go               # Go 1.25+
   winget install OpenJS.NodeJS.LTS       # Node 22 LTS
   winget install Casey.Just              # just (recommended over make)
   winget install Google.CloudSDK         # gcloud (Firestore/GCS via ADC)
   go install github.com/air-verse/air@latest   # backend hot-reload

   # Optional
   winget install Hashicorp.Terraform     # for infra changes
   npm install -g firebase-tools          # for Firestore rules changes
   choco install ngrok                    # only if you need to expose local backend to the public internet
   ```

2. **Sign in to GCP** — the backend uses
   [Application Default Credentials](https://cloud.google.com/docs/authentication/provide-credentials-adc)
   for Firestore / Cloud Storage:

   ```powershell
   gcloud auth application-default login
   gcloud config set project wattrent-staging
   ```

3. **Get a Gemini API key** — sign up at
   <https://aistudio.google.com/apikey> (free tier: 1500 RPD on flash-lite).

4. **Install deps + create .env**

   ```powershell
   just bootstrap
   ```

   This will:
   - Run `go mod download` + `npm install`
   - Copy [`backend/.env.example`](backend/.env.example) to `backend/.env`
     (which is in [`.gitignore`](.gitignore) and never committed)

5. **Edit `backend/.env`** — at minimum, set:

   ```env
   GEMINI_API_KEY=AIza...    # the key from step 3
   ```

   Other defaults (`AUTH_BYPASS=true`, `GCP_PROJECT_ID=wattrent-staging`,
   etc.) work out of the box.

### Day-to-day development (two windows)

```powershell
# Window 1: backend → http://localhost:8080
just backend

# Window 2: frontend
just frontend-web        # web → http://localhost:8081
# or
just frontend-lan        # phones on the same WiFi scan the QR (recommended)
# or
just frontend            # tunnel — works across networks but slower
```

> Without `just` you can run them directly:
> - Backend: `cd backend; air` (set env vars manually first, or use [direnv](https://direnv.net/))
> - Frontend: `cd frontend/wattrent; npx expo start`

---

## Testing on a real device with Expo Go

1. Install [Expo Go](https://expo.dev/go) on your phone.
2. Run `just frontend-lan` (**phone and laptop must be on the same WiFi**).
3. Expo Dev Tools prints a QR code — Android can scan it directly; iOS uses
   the system camera.
4. The frontend auto-detects the Metro hostUri, so the backend URL becomes
   `http://<laptop LAN IP>:8080/api/v1` automatically — no need to hard-code
   IPs (logic lives in
   [`frontend/wattrent/lib/apiUrl.ts`](frontend/wattrent/lib/apiUrl.ts)).
5. Make sure Windows Firewall allows ports 8080 + 8081 (the OS prompt on
   first run; click "Allow").

### What if you're not on the same WiFi?

| Scenario | Frontend | Backend |
| --- | --- | --- |
| Phone on cellular, laptop at home | `just frontend` (tunnel) | Set `EXPO_PUBLIC_API_URL` to staging Cloud Run (see below) |
| Corporate WiFi isolates the laptop | same as above | same as above |
| Need to verify real staging behaviour | `just frontend-lan` | Set `EXPO_PUBLIC_API_URL` |

To skip the local backend and target staging Cloud Run:

```powershell
$env:EXPO_PUBLIC_API_URL='https://wattrent-api-6aiyzfe65q-de.a.run.app/api/v1'
just frontend-lan
```

To expose the local backend to the public internet (rare, e.g. webhook
callback testing):

```powershell
# Window 1
just backend
# Window 2
just backend-tunnel       # `ngrok http 8080` — prints a https://*.ngrok-free.app URL
# Window 3: pass the ngrok URL to the frontend
$env:EXPO_PUBLIC_API_URL='https://your-tunnel.ngrok-free.app/api/v1'
just frontend
```

---

## Cloud services the local backend uses

| Service | Required? | Notes | Can run offline? |
| --- | --- | --- | --- |
| **Firestore** (asia-east1) | Yes | Bills + settings persistence | Run [Firestore Emulator](https://firebase.google.com/docs/emulator-suite/install_and_configure) for full offline; backend does not yet read emulator env vars |
| **Cloud Storage** (`wattrent-meters-staging`) | Yes | Meter photos + V4 signed URLs | Same — no emulator wiring yet |
| **Google AI Studio Gemini API** | Only for the OCR endpoint | If `GEMINI_API_KEY` is empty, the backend still boots; only `/api/v1/ocr/process` returns 503 | Yes — skipping OCR makes it free + offline |
| **Firebase Auth** | Bypassed by default | `AUTH_BYPASS=true` skips token verification and uses fake uid `dev-user` | Yes |
| **Vertex AI** (only when `AI_BACKEND=vertex`) | No | IAM-based, paid; data is not used for training | — |
| **Sentry** | No | Empty `SENTRY_DSN` disables it | Yes |

**Bottom line**: minimum viable local dev needs only a Gemini API key (for
OCR) and ADC (for Firestore/GCS). Want even less? Set `AUTH_BYPASS=true`,
leave `GCP_PROJECT_ID` empty, and stay clear of Firestore/GCS/OCR endpoints
— the backend's `/health` will still respond (but it crashes the moment
you call Firestore). Full offline dev is blocked on the emulator wiring.

---

## Backend env-var reference

The full definition is in
[`backend/internal/config/config.go`](backend/internal/config/config.go);
the template is in [`backend/.env.example`](backend/.env.example).

| Variable | Default | Notes |
| --- | --- | --- |
| `APP_ENV` | `dev` | `dev` / `staging` / `production` / `preview-{n}` |
| `GCP_PROJECT_ID` | _(required unless `AUTH_BYPASS=true`)_ | Shared by Firestore / GCS / Vertex |
| `GCP_REGION` | `asia-east1` | |
| `METERS_BUCKET` | `wattrent-meters-staging` | Meter photo GCS bucket |
| `PORT` | `8080` | Cloud Run injects this automatically |
| `ALLOWED_ORIGINS` | `*` | Comma-separated; production rejects `*` |
| `AUTH_BYPASS` | `false` | `true` skips ID-token check; production forces false |
| `AUTH_BYPASS_UID` | `dev-user` | Fake uid used in bypass mode |
| `AI_BACKEND` | `gemini` | `gemini` (AI Studio free tier) or `vertex` (paid) |
| `GEMINI_API_KEY` | _(required for the gemini backend)_ | Get one at <https://aistudio.google.com/apikey> |
| `GEMINI_MODEL` | `gemini-2.5-flash-lite` | |
| `SENTRY_DSN` | _(empty = disabled)_ | |

Production fail-fast rules (in `config.Load`):
- `AUTH_BYPASS=true` → reject
- `ALLOWED_ORIGINS=*` → reject
- `AI_BACKEND=gemini` with empty `GEMINI_API_KEY` → reject
  (dev/staging fail late: the OCR endpoint just returns 503)

---

## Main API endpoints

| Method | Path | Notes |
| --- | --- | --- |
| GET  | `/health` | Health check (public, no `/api/v1` prefix) |
| POST | `/api/v1/uploads/signed-url` | Get a V4 PUT signed URL (15 min) |
| POST | `/api/v1/ocr/process` | Send an image (base64 or `gs://`) → Gemini → kWh |
| POST | `/api/v1/bills` | Create a bill |
| GET  | `/api/v1/bills` | List the caller's bills |
| GET  | `/api/v1/bills/latest` | Most recent |
| GET  | `/api/v1/bills/:id` | Single bill |
| PUT  | `/api/v1/bills/:id` | Update |
| PUT  | `/api/v1/bills/:id/payment` | Toggle payment status |
| DELETE | `/api/v1/bills/:id` | Delete |
| GET / PUT | `/api/v1/settings` | Per-user defaults |

> Every endpoint except `/health` requires
> `Authorization: Bearer <Firebase ID token>` (skipped when `AUTH_BYPASS=true`).

## Deployment status

| Environment | Status | URL |
| --- | --- | --- |
| Staging | Live | <https://wattrent-api-6aiyzfe65q-de.a.run.app> |
| Production | Locked until Play Store launch | — |

CI/CD goes through GitHub Actions + WIF; the deploy workflow's `production`
option is temporarily removed — see
[.github/workflows/README.md](.github/workflows/README.md).

## Repo layout

```
wattrent/
├── backend/                    Go 1.25 + Gin (Cloud Run)
│   ├── main.go                 Entry point (with graceful shutdown)
│   ├── Dockerfile              multi-stage + distroless
│   ├── .env.example            env-var template
│   ├── .air.toml               air hot-reload config
│   └── internal/
│       ├── config/             Centralised env-var loader
│       ├── clients/            Firestore / Storage / Gemini / Firebase Auth
│       ├── handlers/           HTTP handlers
│       ├── services/           bill / settings / storage / ocr
│       ├── models/             Data structures
│       └── middleware/         Auth / CORS / ErrorHandler
│
├── firestore/                  Firestore rules + indexes
├── frontend/wattrent/          Expo SDK 55 + React Native 0.83
├── terraform/                  IaC (GCP + Cloudflare + Sentry)
├── .github/                    Copilot instructions + workflows
├── Dockerfile                  Old dev container (being phased out)
├── justfile                    One-shot dev shortcuts (Windows / PowerShell; the only recommended runner)
└── README.md
```

> The repo previously maintained both `Makefile` and `justfile`; it has now
> consolidated on `justfile`. To revert, run `git restore Makefile`.

## Development notes

1. **Windows / PowerShell**: chain commands with `;`, **never** `&&`.
2. **Cross-platform line endings**: the repo enforces LF via
   [`.gitattributes`](.gitattributes); Windows clones convert
   automatically.
3. **Env vars**: override the frontend API URL via
   `EXPO_PUBLIC_API_URL`; the backend reads from `backend/.env`.
4. **i18n**: every user-facing string goes through an i18n key (the
   backend only emits keys; the frontend translates).
5. **Secret hygiene**: never commit secrets / API keys; use env vars +
   Secret Manager.
6. **Local Gemini key never gets pushed to Cloud Run** — staging/prod
   inject via GCP Secret Manager, completely separate from
   `backend/.env`.

## FAQ

**Q1: `just backend` is stuck on `init firestore: ... projectID was empty`**
→ You haven't run `just bootstrap`, or `GCP_PROJECT_ID` in `backend/.env`
is empty. The default `wattrent-staging` should work out of the box.

**Q2: `init firestore: rpc error: code = PermissionDenied`**
→ You haven't run `gcloud auth application-default login`, or the signed-in
account lacks Firestore read/write on `wattrent-staging`.

**Q3: `/api/v1/ocr/process` returns `503 ai service unavailable`**
→ `GEMINI_API_KEY` in `backend/.env` is empty.

**Q4: Expo Go on my phone can't reach the backend**
→ Make sure phone and laptop are on the same WiFi and Windows Firewall
allows port 8080. Or temporarily target staging:
`$env:EXPO_PUBLIC_API_URL='https://wattrent-api-6aiyzfe65q-de.a.run.app/api/v1'; just frontend-lan`

**Q5: Demoing to someone else?**
→ Skip the local backend, use staging Cloud Run. Run the frontend in
tunnel mode:
`$env:EXPO_PUBLIC_API_URL='https://wattrent-api-6aiyzfe65q-de.a.run.app/api/v1'; just frontend`

## Detailed docs

- [terraform/README.md](terraform/README.md) — IaC bootstrap and deployment
- [.github/copilot-instructions.md](.github/copilot-instructions.md) — AI agent guide
- [.github/workflows/README.md](.github/workflows/README.md) — CI/CD workflow overview

## TODO

- [ ] Frontend `capture.tsx` should call the real `apiService.processImage()` (currently mocked)
- [ ] Integrate the Firebase Auth Web SDK and end-to-end the token flow
- [ ] Clean up the leftover `192.168.x.x` / `ngrok` URLs in the frontend
- [ ] Pick one of `app.json` / `app.config.js`
- [ ] Wire up Firestore/Storage Emulator for fully offline dev
- [ ] Add test coverage

## License

MIT License
