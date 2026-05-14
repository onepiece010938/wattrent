# ──────────────────────────────────────────────────────────────────────────
# Top-level outputs (consumed by GitHub Actions and the frontend)
# ──────────────────────────────────────────────────────────────────────────

output "gcp_project_id" {
  description = "GCP project ID"
  value       = local.gcp_project_id
}

output "api_service_url" {
  description = "Cloud Run service default URL (*.run.app)"
  value       = module.api.service_url
}

output "api_fqdn" {
  description = "API custom domain (when domain is configured)"
  value       = local.api_fqdn
}

output "meters_bucket" {
  description = "GCS bucket for meter photos"
  value       = module.storage.bucket_name
}

output "artifact_registry_repo" {
  description = "Artifact Registry repository (used to push the Cloud Run image)"
  value       = module.api.artifact_registry_repo
}

output "cloud_run_service_account_email" {
  description = "Cloud Run runtime service account email"
  value       = module.api.service_account_email
}

# ────────── GitHub Actions / OIDC ──────────

output "github_actions_workload_identity_provider" {
  description = "Full Workload Identity Provider name used by GitHub Actions"
  value       = module.cicd.workload_identity_provider
}

output "github_actions_service_account" {
  description = "Service account email impersonated by GitHub Actions"
  value       = module.cicd.service_account_email
}

# ────────── Sentry (when enabled) ──────────

output "sentry_dsn_secret_id" {
  description = "Secret Manager ID for the Sentry DSN"
  value       = var.enable_sentry ? module.observability[0].sentry_dsn_secret_id : ""
}

# ────────── Billing kill switch ──────────

output "billing_budget_amount" {
  description = "Monthly budget cap for this environment"
  value       = "${var.billing_budget_amount} ${var.billing_budget_currency}/month"
}

output "billing_kill_switch_enabled" {
  description = "Whether hitting 100% disables billing automatically"
  value       = var.billing_kill_switch_enabled
}

output "billing_alert_topic" {
  description = "Budget alert Pub/Sub topic (for debugging)"
  value       = module.billing.pubsub_topic
}
