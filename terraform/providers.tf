# ──────────────────────────────────────────────────────────────────────────
# Provider 設定
#
# 認證來源：
#   - Google：HCP TFC 動態 credentials（Workload Identity Federation）
#       → workspace 設環境變數 TFC_GCP_PROVIDER_AUTH=true 等，
#         TFC 會自動寫一份短效 ADC 檔到 runner，再由 google provider 自動讀。
#       → 本地開發：`gcloud auth application-default login`
#       → 完全不需要 GOOGLE_CREDENTIALS（SA JSON key）。
#   - Cloudflare：CLOUDFLARE_API_TOKEN 環境變數（最小權限 Zone:Read + DNS:Edit）。
#       provider 必須宣告（modules/dns 在 required_providers 裡引用），但若
#       cloudflare_zone_id 為空，整個 dns 模組 count=0、不會打任何 API。
#       未啟用時可以塞一個假 token 讓 provider init 過得去。
#   - Sentry：SENTRY_AUTH_TOKEN 環境變數（TFC workspace 標 sensitive）。
#       provider init 階段會做 health check，所以 token 必須是真的；
#       未啟用 enable_sentry 時整個 observability 模組 count=0，但 provider
#       仍會被載入做 health check，因此 token 不能拿掉。
#
# 詳見 scripts/bootstrap.ps1 與 README.md。
# ──────────────────────────────────────────────────────────────────────────

provider "google" {
  project = local.gcp_project_id
  region  = var.gcp_region
}

provider "google-beta" {
  project = local.gcp_project_id
  region  = var.gcp_region
}

provider "cloudflare" {
  # token 從 CLOUDFLARE_API_TOKEN env var 讀，這裡留空允許 provider init。
  # dns 模組在 cloudflare_zone_id 為空時 count=0，不會實際打 Cloudflare API。
}

provider "sentry" {
  # token 從 SENTRY_AUTH_TOKEN env var 讀（TFC workspace 標 sensitive）。
  base_url = "https://sentry.io/api/"
}

provider "random" {}
