# ──────────────────────────────────────────────────────────────────────────
# Staging 環境
#
# ⚠️ 本檔會進 git，請只放「非機密」設定。
#    機密值（billing account / sentry / cloudflare token）走 TFC workspace
#    variables，TFC 注入後優先級高於 tfvars。
#    需要本地 plan 時，建立 envs/staging.local.tfvars（已 gitignore）覆蓋。
# ──────────────────────────────────────────────────────────────────────────

env                  = "staging"
gcp_project_id       = "wattrent-staging"
gcp_region           = "asia-east1"
gcp_storage_location = "ASIA-EAST1"

# Billing account 由 TFC variable `gcp_billing_account`（sensitive）注入。
# 本地測試請建立 envs/staging.local.tfvars 並執行：
#   terraform plan -var-file="envs/staging.tfvars" -var-file="envs/staging.local.tfvars"
# 內容範例：gcp_billing_account = "XXXXXX-XXXXXX-XXXXXX"

# 預算上限（達到自動停付費服務、避免超收）
# Billing account 幣別是 TWD，預算幣別必須一致
billing_budget_amount       = 150 # TWD/月（約 USD 5）
billing_budget_currency     = "TWD"
billing_alert_thresholds    = [0.5, 0.9]
billing_kill_switch_enabled = true

# 首次佈署給 Google 官方 hello-world（公開可拉）。之後 CI build 完 push 上去時，
# module lifecycle.ignore_changes 會讓 TF 不反覆 image。要 pin 在自己的 image 時可改成：
#   api_image = "asia-east1-docker.pkg.dev/wattrent-staging/wattrent/api:latest"
api_image         = "gcr.io/cloudrun/hello"
api_min_instances = 0
api_max_instances = 3
api_cpu           = "1"
api_memory        = "512Mi"

# Domain（先空，等網域準備好再填）
domain_root        = ""
api_subdomain      = "api"
cloudflare_zone_id = ""

# Auth 允許的 redirect 網域
auth_authorized_domains = [
  "localhost",
  "wattrent-staging.web.app",
]

# CI/CD
github_repository = "onepiece010938/wattrent"

# Observability
enable_sentry       = true
sentry_organization = "wattrent"

extra_labels = {
  cost-center = "dev"
}

