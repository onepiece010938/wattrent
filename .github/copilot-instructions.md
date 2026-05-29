# WattRent — Copilot / Agent global guide

This file is auto-loaded into every conversation and provides the high-level mental model for the whole repo.
**Scope-specific** rules (frontend, backend, infra) live under [`.github/instructions/`](./instructions/) and are auto-applied based on file path.

---

## One-line summary

WattRent is an **Expo / React Native** mobile app (iOS / Android / Web) backed by a **Go + Gin** REST API that helps tenants "snap the meter → compute the bill → notify the landlord". Everything runs on **GCP (Cloud Run + Firestore + Cloud Storage)**. OCR defaults to the **Google AI Studio Gemini API** (free tier) and can be swapped to Vertex AI via `AI_BACKEND=vertex`.

## Repository layout

```
wattrent/
├── backend/                    ← Go 1.25 + Gin (deployed to Cloud Run)
│   ├── main.go                  Entry point (with graceful shutdown)
│   ├── Dockerfile               distroless multi-stage build
│   ├── .env.example             Local dev env-var template
│   └── internal/
│       ├── config/              Centralised os.Getenv loader
│       ├── clients/             Firebase Auth / Firestore / GCS / Gemini (AI Studio or Vertex)
│       ├── handlers/            HTTP handlers; call into services
│       ├── services/            Business logic (Firestore / Storage / OCR)
│       ├── models/              Data structures (with firestore tags)
│       └── middleware/          CORS, Auth, ErrorHandler
│
├── firestore/                  ← Firestore rules + indexes (consumed by `firebase deploy`)
│   ├── firestore.rules
│   └── firestore.indexes.json
├── firebase.json               Tells the firebase CLI where the two files above live
│
├── terraform/                  ← IaC (HCP Terraform Cloud + GCP + Cloudflare + Sentry)
│   ├── main.tf / providers.tf / locals.tf / outputs.tf …
│   ├── envs/{staging,production}.tfvars
│   └── modules/
│       ├── project_services/   Enable GCP APIs
│       ├── api/                Cloud Run + SA + Artifact Registry
│       ├── database/           Firestore database
│       ├── storage/            GCS bucket (meter photos)
│       ├── auth/               Identity Platform
│       ├── cicd/               GitHub Actions WIF
│       ├── dns/                Cloudflare records
│       └── observability/      Sentry
│
├── frontend/wattrent/          ← Expo SDK 55 + React Native 0.83 + React 19
│   ├── app/                     expo-router file-based routes
│   ├── components/              Shared components
│   ├── services/                api.ts / settings.ts
│   ├── lib/                     i18n, cn, useColorScheme
│   ├── locales/{en,zh-TW}.json
│   └── app.config.js            ⚠️ The real Expo config (app.json is legacy)
│
├── .github/
│   ├── copilot-instructions.md  This file
│   ├── instructions/            Scope-specific rules
│   └── workflows/               CI / deploy / infra / security
│
├── Dockerfile                   Old dev container (being phased out)
├── justfile                     One-shot dev shortcuts
└── README.md
```

## Dev environment

* OS: **Windows 11**
* Shell: **PowerShell** (chain commands with `;`, **never `&&`**)
* Encoding: UTF-8
* Cloud CLIs: `gcloud`, `firebase`, `terraform`, `eas`

## How to start

```powershell
# Install everything
just install

# Backend (local Cloud Run sim with Air hot reload)
just backend          # → http://localhost:8080
# Local dev defaults to AUTH_BYPASS=true with a fake uid

# Frontend
just frontend-web     # web → http://localhost:8081
just frontend         # tunnel mode (scan QR code with Expo Go on a real device)
```

> Without `just` you can run `cd backend; air` / `cd frontend/wattrent; npx expo start` directly.

## Deploy architecture

| Layer | Service |
| --- | --- |
| Backend | Cloud Run (asia-east1) |
| DB | Firestore Native Mode (asia-east1) |
| Object storage | GCS (meter photos, single-region asia-east1) |
| OCR | Gemini 2.5 Flash-Lite (defaults to Google AI Studio free tier; `AI_BACKEND=vertex` switches to Vertex AI) |
| Auth | Identity Platform / Firebase Auth |
| DNS / CDN | Cloudflare |
| Secrets | GCP Secret Manager (injected into Cloud Run env) |
| IaC | Terraform (state on HCP Terraform Cloud) |
| CI/CD | GitHub Actions + Workload Identity Federation (no long-lived keys) |
| Observability | Sentry (front + back) + Cloud Logging |

See [terraform/README.md](../terraform/README.md) and [.github/workflows/README.md](./workflows/README.md) for details.

> (Internal design / cost notes live in the local `docs/` folder, which is git-ignored.)

## Cross-cutting rules

### Language / i18n
* **Frontend**: all user-facing strings go through i18n (`locales/en.json`, `locales/zh-TW.json`).
* **Backend**: never produce user-facing strings. `ApiResponse.Error` / `Message` always store an **i18n key** (e.g. `bills.created`, `errors.bill.not_found`); the frontend's `t()` translates them.

### API conventions
* All routes live under `/api/v1/`.
* RESTful with plural resource nouns (`/bills`, `/settings`, `/uploads`, `/ocr`).
* Uniform response: `models.ApiResponse{Success, Data, Error, Message}`.
* Timestamps in JSON use RFC3339 strings.
* Money / quantities use `float64` ↔ `number`.
* Auth: every endpoint except `/health` requires `Authorization: Bearer <Firebase ID token>`.

### Security
* **Never** hard-code secrets / API keys; always use env vars + Secret Manager.
* The backend must not trust `userId` from the client; **always** read it from the verified ID token (`middleware.GetUID(c)`).
* GCS objects are not public-readable; the frontend uses backend-issued V4 signed URLs (15 min for upload, 1 h for read).
* CORS: `production` enforces an allowlist; `*` is forbidden.

### Deploy / IaC
* All GCP resources are managed by Terraform — **don't click around in the console** (except for bootstrap).
* GitHub Actions uses OIDC (Workload Identity Federation); no long-lived GCP keys live in the repo.
* CI pushes the Cloud Run image tag; Terraform uses `lifecycle.ignore_changes` to avoid drift.

## Tooling preferences

* Backend: `go mod` (no vendor dir); lint = `gofmt` + `go vet`; tests = `testing` + table-driven.
* Frontend: `npm` (don't mix yarn / pnpm); lint = `expo lint`; tests (not yet implemented) = Jest.
* IaC: `terraform fmt -recursive` + `terraform validate`.
* Containers: multi-stage + distroless; don't push dev images to the production registry.

## Known legacy issues

1. ~~`backend/main.oldgo` had the wrong extension~~ → rewritten as `backend/main.go`.
2. ~~`ImageAnalysisQuickstart.go` leaked an Azure key~~ → deleted. **Still revoke that key in the Azure portal** (it remains in git history).
3. ~~Backend stored data in memory only~~ → now on Firestore.
4. ~~No auth (hard-coded user1)~~ → Firebase Auth wired up; local dev uses `AUTH_BYPASS=true`.
5. ~~OCR was a stub~~ → backend now calls Gemini (defaults to AI Studio API via the `google.golang.org/genai` unified SDK); the frontend `capture.tsx` still needs to call `apiService.processImage()`.
6. ~~Hard-coded `192.168.0.172` / `ngrok` URLs are still scattered through the frontend~~ → removed; use `EXPO_PUBLIC_API_URL` + `lib/apiUrl.ts`.
7. `app.json` and `app.config.js` both exist; `app.config.js` is canonical (Expo loads `.js` when both are present). `app.json` only kept as fallback for non-config-aware tools.
8. ~~No test coverage yet~~ → Jest + jest-expo wired up; backend has `go test`; both grow incrementally.

## Documentation rules

* The `docs/` folder is not in the repo (git-ignored). Important architecture / cost / decision records live in the local `docs/` folder; keep it in sync when you change things.
* Don't add lots of new markdown files unless asked.
