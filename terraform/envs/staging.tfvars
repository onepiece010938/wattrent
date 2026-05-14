# ──────────────────────────────────────────────────────────────────────────
# Staging environment
#
# ⚠️ This file is committed to git. Only put non-sensitive settings here.
#    Sensitive values (billing account / sentry / cloudflare token) live in
#    TFC workspace variables, which are injected with higher priority than tfvars.
#    For local plans, create envs/staging.local.tfvars (gitignored) to override.
# ──────────────────────────────────────────────────────────────────────────

env                  = "staging"
gcp_project_id       = "wattrent-staging"
gcp_region           = "asia-east1"
gcp_storage_location = "ASIA-EAST1"

# The billing account is injected via the TFC variable `gcp_billing_account` (sensitive).
# For local testing, create envs/staging.local.tfvars and run:
#   terraform plan -var-file="envs/staging.tfvars" -var-file="envs/staging.local.tfvars"
# Example contents: gcp_billing_account = "XXXXXX-XXXXXX-XXXXXX"

# Budget cap (auto-disables paid services when reached, prevents overage).
# The billing account currency is TWD, so the budget currency must match.
billing_budget_amount       = 150 # TWD/month (~USD 5)
billing_budget_currency     = "TWD"
billing_alert_thresholds    = [0.5, 0.9]
billing_kill_switch_enabled = true

# First deploy uses Google's official hello-world (publicly pullable). Once CI builds
# and pushes its own image, lifecycle.ignore_changes inside the module keeps TF from
# bouncing it. To pin to your own image use:
#   api_image = "asia-east1-docker.pkg.dev/wattrent-staging/wattrent/api:latest"
api_image         = "gcr.io/cloudrun/hello"
api_min_instances = 0
api_max_instances = 3
api_cpu           = "1"
api_memory        = "512Mi"

# Domain (leave empty until the domain is ready).
domain_root        = ""
api_subdomain      = "api"
cloudflare_zone_id = ""

# Auth: allowed redirect domains.
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

