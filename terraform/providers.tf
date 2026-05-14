# ──────────────────────────────────────────────────────────────────────────
# Provider configuration
#
# Auth sources:
#   - Google: dynamic credentials from HCP TFC (Workload Identity Federation).
#       → Set workspace env vars TFC_GCP_PROVIDER_AUTH=true, etc.
#         TFC writes a short-lived ADC file onto the runner and the google
#         provider picks it up automatically.
#       → Local dev: `gcloud auth application-default login`.
#       → No GOOGLE_CREDENTIALS (SA JSON key) needed at all.
#   - Cloudflare: CLOUDFLARE_API_TOKEN env var (least privilege: Zone:Read + DNS:Edit).
#       The provider must be declared (modules/dns references it in
#       required_providers), but when cloudflare_zone_id is empty the entire
#       dns module has count=0 and never calls the Cloudflare API.
#       When unused you can supply a dummy token just so provider init succeeds.
#   - Sentry: SENTRY_AUTH_TOKEN env var (marked sensitive on the TFC workspace).
#       Provider init runs a health check, so the token must be real;
#       even when enable_sentry=false the observability module is count=0
#       but the provider is still loaded for the health check, so the token
#       cannot simply be removed.
#
# See scripts/bootstrap.ps1 and README.md for more.
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
  # Token comes from the CLOUDFLARE_API_TOKEN env var; left empty here so provider init succeeds.
  # The dns module has count=0 when cloudflare_zone_id is empty, so no Cloudflare API is hit.
}

provider "sentry" {
  # Token comes from the SENTRY_AUTH_TOKEN env var (marked sensitive on the TFC workspace).
  base_url = "https://sentry.io/api/"
}

provider "random" {}
