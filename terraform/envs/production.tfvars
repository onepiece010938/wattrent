# ──────────────────────────────────────────────────────────────────────────
# Production 環境
#
# ⚠️ 本檔會進 git，請只放「非機密」設定。
#    機密值（billing account / sentry / cloudflare token）走 TFC workspace
#    variables，TFC 注入後優先級高於 tfvars。
# ──────────────────────────────────────────────────────────────────────────

env                   = "production"
gcp_project_id        = "wattrent-prod"
gcp_region            = "asia-east1"
gcp_storage_location  = "ASIA-EAST1"

# Billing account 由 TFC variable `gcp_billing_account`（sensitive）注入。

# 預算上限：一開始設小一點，上架有人用之後再調高。
# 達到並不代表太多人用——也可能是被攻擊。先讓 kill switch 護你。
# Billing account 幣別是 TWD，預算幣別必須一致
billing_budget_amount        = 900  # TWD/月（約 USD 30）
billing_budget_currency      = "TWD"
billing_alert_thresholds     = [0.5, 0.9]
billing_kill_switch_enabled  = true

api_image             = "gcr.io/cloudrun/hello" # 首次佈署 placeholder；推出 stable image 後改成 asia-east1-docker.pkg.dev/wattrent-prod/wattrent/api:stable
api_min_instances     = 0   # 起步先 scale-to-zero；流量穩定後可調 1
api_max_instances     = 20
api_cpu               = "1"
api_memory            = "512Mi"

# Domain
domain_root           = "wattrent.app"
api_subdomain         = "api"
cloudflare_zone_id    = "" # 從 Cloudflare dashboard 拿

# Auth
auth_authorized_domains = [
  "wattrent.app",
  "www.wattrent.app",
]

# CI/CD
github_repository     = "onepiece010938/wattrent"

# Observability
enable_sentry         = true
sentry_organization   = "" # Sentry org slug

extra_labels = {
  cost-center = "ops"
}

