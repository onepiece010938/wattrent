# ──────────────────────────────────────────────────────────────────────────
# 頂層輸出（給 GitHub Actions 與 frontend 拿）
# ──────────────────────────────────────────────────────────────────────────

output "gcp_project_id" {
  description = "GCP project ID"
  value       = local.gcp_project_id
}

output "api_service_url" {
  description = "Cloud Run service 預設 URL（*.run.app）"
  value       = module.api.service_url
}

output "api_fqdn" {
  description = "API 自訂網域（若設定 domain）"
  value       = local.api_fqdn
}

output "meters_bucket" {
  description = "GCS bucket：電表照片"
  value       = module.storage.bucket_name
}

output "artifact_registry_repo" {
  description = "Artifact Registry repository（推 Cloud Run image 用）"
  value       = module.api.artifact_registry_repo
}

output "cloud_run_service_account_email" {
  description = "Cloud Run runtime service account email"
  value       = module.api.service_account_email
}

# ────────── GitHub Actions / OIDC ──────────

output "github_actions_workload_identity_provider" {
  description = "GitHub Actions 用的 Workload Identity Provider 完整名稱"
  value       = module.cicd.workload_identity_provider
}

output "github_actions_service_account" {
  description = "GitHub Actions impersonate 的 service account email"
  value       = module.cicd.service_account_email
}

# ────────── Sentry（若啟用） ──────────

output "sentry_dsn_secret_id" {
  description = "Sentry DSN 在 Secret Manager 的 ID"
  value       = var.enable_sentry ? module.observability[0].sentry_dsn_secret_id : ""
}

# ────────── Billing kill switch ──────────

output "billing_budget_amount" {
  description = "本環境每月預算上限"
  value       = "${var.billing_budget_amount} ${var.billing_budget_currency}/月"
}

output "billing_kill_switch_enabled" {
  description = "達到 100% 是否自動停 billing"
  value       = var.billing_kill_switch_enabled
}

output "billing_alert_topic" {
  description = "Budget alert Pub/Sub topic（除錯用）"
  value       = module.billing.pubsub_topic
}
