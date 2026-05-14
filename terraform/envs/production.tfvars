# ──────────────────────────────────────────────────────────────────────────
# Production environment
#
# ⚠️ This file is committed to git. Only put non-sensitive settings here.
#    Sensitive values (billing account / sentry / cloudflare token) live in
#    TFC workspace variables, which are injected with higher priority than tfvars.
# ──────────────────────────────────────────────────────────────────────────

env                  = "production"
gcp_project_id       = "wattrent-prod"
gcp_region           = "asia-east1"
gcp_storage_location = "ASIA-EAST1"

# The billing account is injected via the TFC variable `gcp_billing_account` (sensitive).

# Budget cap: start small and raise once the app is in real use.
# Hitting it does not necessarily mean too many users — it could also mean abuse, so
# let the kill switch protect you first.
# The billing account currency is TWD, so the budget currency must match.
billing_budget_amount       = 900 # TWD/month (~USD 30)
billing_budget_currency     = "TWD"
billing_alert_thresholds    = [0.5, 0.9]
billing_kill_switch_enabled = true

api_image         = "gcr.io/cloudrun/hello" # First-deploy placeholder; switch to asia-east1-docker.pkg.dev/wattrent-prod/wattrent/api:stable once a stable image exists.
api_min_instances = 0                       # Start with scale-to-zero; raise to 1 once traffic stabilises.
api_max_instances = 20
api_cpu           = "1"
api_memory        = "512Mi"

# Domain
domain_root        = "wattrent.app"
api_subdomain      = "api"
cloudflare_zone_id = "" # Grab from the Cloudflare dashboard.

# Auth
auth_authorized_domains = [
  "wattrent.app",
  "www.wattrent.app",
]

# CI/CD
github_repository = "onepiece010938/wattrent"

# Observability
enable_sentry       = true
sentry_organization = "" # Sentry org slug

extra_labels = {
  cost-center = "ops"
}

