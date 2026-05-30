# ──────────────────────────────────────────────────────────────────────
# WattRent — local dev commands (Windows / PowerShell first)
#
# Quickstart:
#   just bootstrap     First time: install deps + create backend/.env
#   just backend       Backend on :8080 (air hot reload, auto-loads backend/.env)
#   just frontend-web  Frontend web → http://localhost:8081
#   just frontend      Frontend tunnel mode for a real device with Expo Go
# ──────────────────────────────────────────────────────────────────────

set shell := ["powershell", "-NoProfile", "-Command"]

BACKEND_DIR  := ".\\backend"
FRONTEND_DIR := ".\\frontend\\wattrent"
TERRAFORM_DIR := ".\\terraform"

# Default: show all recipes
help:
  just --list

# ────────────────────────── Setup ──────────────────────────

# First time: install deps + create backend/.env (copied from .env.example)
bootstrap: install
  if (-not (Test-Path "{{BACKEND_DIR}}\.env")) { Copy-Item "{{BACKEND_DIR}}\.env.example" "{{BACKEND_DIR}}\.env" ; Write-Host "Created {{BACKEND_DIR}}\.env from .env.example" ; Write-Host "   Open it and fill in GEMINI_API_KEY (get one from https://aistudio.google.com/apikey)" } else { Write-Host "{{BACKEND_DIR}}\.env already exists, skipping" }
  Write-Host ""
  Write-Host "Next steps:"
  Write-Host "  1) gcloud auth application-default login   # Firestore/GCS use ADC"
  Write-Host "  2) just backend                            # Backend"
  Write-Host "  3) just frontend-web (or just frontend)    # Frontend"

# Install backend + frontend dependencies
install:
  Write-Host "==> Installing backend dependencies"
  Push-Location {{BACKEND_DIR}}; go mod download; Pop-Location
  Write-Host "==> Installing frontend dependencies"
  Push-Location {{FRONTEND_DIR}}; npm install; Pop-Location

# ────────────────────────── Run ──────────────────────────

# Backend (air hot reload, auto-loads backend/.env, no ngrok).
# Listens on :8080; the frontend infers the LAN IP from Metro hostUri,
# so no tunnel is needed.
#
# WARNING: this whole recipe must be a single PowerShell invocation
# (chained with `;`). Otherwise [Environment]::SetEnvironmentVariable
# values set in one line are not visible to the next line (air).
backend:
  if (-not (Test-Path "{{BACKEND_DIR}}\.env")) { Write-Warning "{{BACKEND_DIR}}\.env not found. Run: just bootstrap"; exit 1 } ; \
  Get-Content "{{BACKEND_DIR}}\.env" | Where-Object { $_ -match '^\s*[A-Z][A-Z0-9_]*\s*=' -and $_ -notmatch '^\s*#' } | ForEach-Object { $k, $v = $_ -split '=', 2; [Environment]::SetEnvironmentVariable($k.Trim(), $v.Trim().Trim('"').Trim("'"), 'Process') } ; \
  Write-Host "==> Starting backend on http://localhost:8080 (air hot reload)" ; \
  Push-Location {{BACKEND_DIR}} ; air ; Pop-Location

# Backend + ngrok (only when you need to expose the local backend to the public
# internet, e.g. for callback testing). Run `ngrok config add-authtoken <token>`
# at least once before using this.
backend-tunnel:
  Write-Host "==> Starting ngrok on :8080 (Ctrl+C to stop)"
  ngrok http 8080

# Frontend tunnel mode — works for a physical device on a different network
frontend:
  Push-Location {{FRONTEND_DIR}}; npx expo start --tunnel; Pop-Location

# Frontend LAN mode — phones on the same WiFi can scan the QR; backend uses LAN IP
frontend-lan:
  Push-Location {{FRONTEND_DIR}}; npx expo start; Pop-Location

# Frontend web build → http://localhost:8081
frontend-web:
  Push-Location {{FRONTEND_DIR}}; npx expo start --web; Pop-Location

# Frontend iOS simulator (macOS only)
frontend-ios:
  Push-Location {{FRONTEND_DIR}}; npx expo start --ios; Pop-Location

# Frontend Android emulator
frontend-android:
  Push-Location {{FRONTEND_DIR}}; npx expo start --android; Pop-Location

# Multi-terminal dev hint
dev:
  Write-Host "Open two PowerShell windows:" -ForegroundColor Cyan
  Write-Host "    Window 1:  just backend"
  Write-Host "    Window 2:  just frontend-web   (or just frontend / just frontend-lan)"
  Write-Host ""
  Write-Host "First time: run `just bootstrap` and edit backend\.env to set GEMINI_API_KEY" -ForegroundColor Yellow

# ────────────────────────── Backend checks ──────────────────────────

backend-build:
  Push-Location {{BACKEND_DIR}}; go build ./...; Pop-Location

backend-test:
  Push-Location {{BACKEND_DIR}}; go test -race ./...; Pop-Location

backend-vet:
  Push-Location {{BACKEND_DIR}}; go vet ./...; Pop-Location

# gofmt check; fails if any file is not formatted
backend-lint:
  Push-Location {{BACKEND_DIR}} ; $diff = gofmt -l . ; Pop-Location ; if ($diff) { Write-Error "gofmt failed:`n$diff" ; exit 1 }

# ────────────────────────── Frontend checks ──────────────────────────

frontend-lint:
  Push-Location {{FRONTEND_DIR}}; npx expo lint; Pop-Location

frontend-typecheck:
  Push-Location {{FRONTEND_DIR}}; npx tsc --noEmit; Pop-Location

# ────────────────────────── E2E (Maestro) ──────────────────────────
#
# Maestro is local-first: install the CLI once, boot a simulator / emulator
# that has the WattRent app installed, then run a YAML flow against it.
#
# Windows note: Maestro CLI doesn't run natively on Windows. Install it
# inside WSL2 (Ubuntu), and run an Android emulator on Windows (or inside
# WSL with KVM). The `e2e-*` recipes below shell out to `wsl maestro ...`
# automatically when running on Windows. See frontend/wattrent/.maestro/README.md.

# Install the Maestro CLI. Uses WSL on Windows, native install otherwise.
e2e-install:
  if ($IsWindows -or $env:OS -eq 'Windows_NT') { Write-Host '==> Installing Maestro inside WSL (Ubuntu)' ; wsl bash -c 'curl -Ls https://get.maestro.mobile.dev | bash' } else { curl -Ls https://get.maestro.mobile.dev | bash }
  Write-Host ''
  Write-Host 'Verify with: just e2e-doctor'

# Verify the Maestro install + show connected devices.
e2e-doctor:
  if ($IsWindows -or $env:OS -eq 'Windows_NT') { wsl bash -c 'maestro --version ; adb devices' } else { maestro --version ; adb devices }

# Run the full Maestro suite against whatever simulator / emulator is running.
e2e:
  if ($IsWindows -or $env:OS -eq 'Windows_NT') { Push-Location {{FRONTEND_DIR}} ; wsl maestro test .maestro/ ; Pop-Location } else { Push-Location {{FRONTEND_DIR}} ; maestro test .maestro/ ; Pop-Location }

# Run a single flow. Usage: just e2e-one .maestro/sign-in.yaml
e2e-one FLOW:
  if ($IsWindows -or $env:OS -eq 'Windows_NT') { Push-Location {{FRONTEND_DIR}} ; wsl maestro test {{FLOW}} ; Pop-Location } else { Push-Location {{FRONTEND_DIR}} ; maestro test {{FLOW}} ; Pop-Location }

# Quick smoke test — only the bypass-mode flow, which doesn't need real
# Firebase Auth credentials. Fastest way to verify the local pipeline works.
e2e-smoke:
  if ($IsWindows -or $env:OS -eq 'Windows_NT') { Push-Location {{FRONTEND_DIR}} ; wsl maestro test .maestro/bypass-mode-smoke.yaml ; Pop-Location } else { Push-Location {{FRONTEND_DIR}} ; maestro test .maestro/bypass-mode-smoke.yaml ; Pop-Location }

# Open the Maestro Studio (interactive flow recorder) against a running device.
e2e-studio:
  if ($IsWindows -or $env:OS -eq 'Windows_NT') { Push-Location {{FRONTEND_DIR}} ; wsl maestro studio ; Pop-Location } else { Push-Location {{FRONTEND_DIR}} ; maestro studio ; Pop-Location }

# ────────────────────────── Terraform ──────────────────────────

tf-fmt:
  Push-Location {{TERRAFORM_DIR}}; terraform fmt -recursive; Pop-Location

tf-validate:
  Push-Location {{TERRAFORM_DIR}}; terraform validate; Pop-Location

tf-plan-staging:
  Push-Location {{TERRAFORM_DIR}} ; $env:TF_WORKSPACE='wattrent-staging' ; terraform plan -var-file=envs/staging.tfvars ; Pop-Location

tf-apply-staging:
  Push-Location {{TERRAFORM_DIR}} ; $env:TF_WORKSPACE='wattrent-staging' ; terraform apply -var-file=envs/staging.tfvars ; Pop-Location

# Production is locked for now; unlock right before launch (CI uses the same
# guard, see .github/workflows/infra.yml)
tf-plan-prod:
  Write-Warning "Production is currently locked. To unlock, run manually:`n  cd terraform; `$env:TF_WORKSPACE='wattrent-production'; terraform plan -var-file=envs/production.tfvars"

tf-apply-prod:
  Write-Warning "Production is currently locked. To unlock, run manually:`n  cd terraform; `$env:TF_WORKSPACE='wattrent-production'; terraform apply -var-file=envs/production.tfvars"

# ────────────────────────── Firestore ──────────────────────────

firestore-deploy:
  firebase deploy --only firestore:rules,firestore:indexes

# ────────────────────────── Maintenance ──────────────────────────

# Clear air's tmp folder and reset the Expo router boilerplate
reset:
  Write-Host "==> Cleaning backend tmp"
  Remove-Item -Recurse -Force "{{BACKEND_DIR}}\tmp\*" -ErrorAction SilentlyContinue
  Write-Host "==> Resetting frontend project"
  Push-Location {{FRONTEND_DIR}}; npm run reset-project; Pop-Location

# Print tool versions (for debugging local environments)
versions:
  Write-Host "── Tooling versions ──" -ForegroundColor Cyan
  Write-Host "go      : $(go version)"
  Write-Host "node    : $(node --version)"
  Write-Host "npm     : $(npm --version)"
  Write-Host "air     : $(air -v 2>&1 | Select-Object -First 1)"
  Write-Host "gcloud  : $(gcloud --version 2>&1 | Select-Object -First 1)"
  Write-Host "firebase: $(firebase --version 2>&1 | Select-Object -First 1)"
  Write-Host "terraform: $(terraform version 2>&1 | Select-Object -First 1)"
