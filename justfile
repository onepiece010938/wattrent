# ──────────────────────────────────────────────────────────────────────
# WattRent — local dev commands (Windows / PowerShell first)
#
# Quickstart:
#   just bootstrap     第一次：裝依賴 + 建 backend/.env
#   just backend       後端 :8080（air 熱重載，自動載 backend/.env）
#   just frontend-web  前端 web → http://localhost:8081
#   just frontend      前端 tunnel 給實機 Expo Go 掃 QR
# ──────────────────────────────────────────────────────────────────────

set shell := ["powershell", "-NoProfile", "-Command"]

BACKEND_DIR  := ".\\backend"
FRONTEND_DIR := ".\\frontend\\wattrent"
TERRAFORM_DIR := ".\\terraform"

# Default: show all recipes
help:
  just --list

# ────────────────────────── Setup ──────────────────────────

# 第一次來：裝依賴 + 建 backend/.env（從 .env.example 複製）
bootstrap: install
  if (-not (Test-Path "{{BACKEND_DIR}}\.env")) { Copy-Item "{{BACKEND_DIR}}\.env.example" "{{BACKEND_DIR}}\.env" ; Write-Host "✅ Created {{BACKEND_DIR}}\.env from .env.example" ; Write-Host "   👉 開啟它填 GEMINI_API_KEY（從 https://aistudio.google.com/apikey 拿）" } else { Write-Host "ℹ️  {{BACKEND_DIR}}\.env already exists, skip" }
  Write-Host ""
  Write-Host "下一步："
  Write-Host "  1) gcloud auth application-default login   # Firestore/GCS 用 ADC"
  Write-Host "  2) just backend                            # 後端"
  Write-Host "  3) just frontend-web (or just frontend)    # 前端"

# 裝前後端依賴
install:
  Write-Host "==> Installing backend dependencies"
  Push-Location {{BACKEND_DIR}}; go mod download; Pop-Location
  Write-Host "==> Installing frontend dependencies"
  Push-Location {{FRONTEND_DIR}}; npm install; Pop-Location

# ────────────────────────── Run ──────────────────────────

# 後端（air 熱重載，自動載 backend/.env，無 ngrok）
# 監聽 :8080；frontend 會從 Metro hostUri 自動推 LAN IP，不需要 tunnel。
#
# ⚠️ 整段必須是「一個 PowerShell 呼叫」（用 `;` 串接），不然 [Environment]::SetEnvironmentVariable
#    在前一行設的 env 在下一行（air）就讀不到了。
backend:
  if (-not (Test-Path "{{BACKEND_DIR}}\.env")) { Write-Warning "{{BACKEND_DIR}}\.env not found. Run: just bootstrap"; exit 1 } ; \
  Get-Content "{{BACKEND_DIR}}\.env" | Where-Object { $_ -match '^\s*[A-Z][A-Z0-9_]*\s*=' -and $_ -notmatch '^\s*#' } | ForEach-Object { $k, $v = $_ -split '=', 2; [Environment]::SetEnvironmentVariable($k.Trim(), $v.Trim().Trim('"').Trim("'"), 'Process') } ; \
  Write-Host "==> Starting backend on http://localhost:8080 (air hot reload)" ; \
  Push-Location {{BACKEND_DIR}} ; air ; Pop-Location

# 後端 + ngrok（只有想把本機 backend 暴露到外網時才用，例如 callback 測試）
# 跑前 ngrok 至少 `ngrok config add-authtoken <token>` 一次
backend-tunnel:
  Write-Host "==> Starting ngrok on :8080 (Ctrl+C to stop)"
  ngrok http 8080

# 前端 tunnel 模式 — 實機 Expo Go 隔網路也能連
frontend:
  Push-Location {{FRONTEND_DIR}}; npx expo start --tunnel; Pop-Location

# 前端 LAN 模式 — 同 WiFi 的手機可直接掃 QR；後端走 LAN IP
frontend-lan:
  Push-Location {{FRONTEND_DIR}}; npx expo start; Pop-Location

# 前端 web 版本 → http://localhost:8081
frontend-web:
  Push-Location {{FRONTEND_DIR}}; npx expo start --web; Pop-Location

# 前端 iOS 模擬器（macOS only）
frontend-ios:
  Push-Location {{FRONTEND_DIR}}; npx expo start --ios; Pop-Location

# 前端 Android 模擬器
frontend-android:
  Push-Location {{FRONTEND_DIR}}; npx expo start --android; Pop-Location

# 多終端開發指引
dev:
  Write-Host "👉 開兩個 PowerShell 視窗：" -ForegroundColor Cyan
  Write-Host "    視窗 1:  just backend"
  Write-Host "    視窗 2:  just frontend-web   (or just frontend / just frontend-lan)"
  Write-Host ""
  Write-Host "首次：先 `just bootstrap` 並編輯 backend\.env 填 GEMINI_API_KEY" -ForegroundColor Yellow

# ────────────────────────── Backend checks ──────────────────────────

backend-build:
  Push-Location {{BACKEND_DIR}}; go build ./...; Pop-Location

backend-test:
  Push-Location {{BACKEND_DIR}}; go test -race ./...; Pop-Location

backend-vet:
  Push-Location {{BACKEND_DIR}}; go vet ./...; Pop-Location

# gofmt 檢查；有未格式化檔案會失敗
backend-lint:
  Push-Location {{BACKEND_DIR}} ; $diff = gofmt -l . ; Pop-Location ; if ($diff) { Write-Error "gofmt 未通過：`n$diff" ; exit 1 }

# ────────────────────────── Frontend checks ──────────────────────────

frontend-lint:
  Push-Location {{FRONTEND_DIR}}; npx expo lint; Pop-Location

frontend-typecheck:
  Push-Location {{FRONTEND_DIR}}; npx tsc --noEmit; Pop-Location

# ────────────────────────── Terraform ──────────────────────────

tf-fmt:
  Push-Location {{TERRAFORM_DIR}}; terraform fmt -recursive; Pop-Location

tf-validate:
  Push-Location {{TERRAFORM_DIR}}; terraform validate; Pop-Location

tf-plan-staging:
  Push-Location {{TERRAFORM_DIR}} ; $env:TF_WORKSPACE='wattrent-staging' ; terraform plan -var-file=envs/staging.tfvars ; Pop-Location

tf-apply-staging:
  Push-Location {{TERRAFORM_DIR}} ; $env:TF_WORKSPACE='wattrent-staging' ; terraform apply -var-file=envs/staging.tfvars ; Pop-Location

# Production 暫時鎖住，發表前再開（CI 也是同樣鎖法，見 .github/workflows/infra.yml）
tf-plan-prod:
  Write-Warning "Production 暫時鎖住。確定要解鎖請手動跑：`n  cd terraform; `$env:TF_WORKSPACE='wattrent-production'; terraform plan -var-file=envs/production.tfvars"

tf-apply-prod:
  Write-Warning "Production 暫時鎖住。確定要解鎖請手動跑：`n  cd terraform; `$env:TF_WORKSPACE='wattrent-production'; terraform apply -var-file=envs/production.tfvars"

# ────────────────────────── Firestore ──────────────────────────

firestore-deploy:
  firebase deploy --only firestore:rules,firestore:indexes

# ────────────────────────── Maintenance ──────────────────────────

# 清 air 暫存 + 重置 Expo router 範例
reset:
  Write-Host "==> Cleaning backend tmp"
  Remove-Item -Recurse -Force "{{BACKEND_DIR}}\tmp\*" -ErrorAction SilentlyContinue
  Write-Host "==> Resetting frontend project"
  Push-Location {{FRONTEND_DIR}}; npm run reset-project; Pop-Location

# 列出工具版本（debug 環境用）
versions:
  Write-Host "── Tooling versions ──" -ForegroundColor Cyan
  Write-Host "go      : $(go version)"
  Write-Host "node    : $(node --version)"
  Write-Host "npm     : $(npm --version)"
  Write-Host "air     : $(air -v 2>&1 | Select-Object -First 1)"
  Write-Host "gcloud  : $(gcloud --version 2>&1 | Select-Object -First 1)"
  Write-Host "firebase: $(firebase --version 2>&1 | Select-Object -First 1)"
  Write-Host "terraform: $(terraform version 2>&1 | Select-Object -First 1)"