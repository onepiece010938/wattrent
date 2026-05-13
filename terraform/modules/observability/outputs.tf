output "backend_project_slug" {
  description = "Sentry backend project slug"
  value       = sentry_project.backend.slug
}

output "frontend_project_slug" {
  description = "Sentry frontend project slug"
  value       = sentry_project.frontend.slug
}

output "sentry_dsn_secret_id" {
  description = "Backend Sentry DSN 在 Secret Manager 的 ID"
  value       = google_secret_manager_secret.sentry_dsn_backend.secret_id
  # 確保下游 (Cloud Run) 等到 secret_version 真正寫入後才會 reference latest
  depends_on = [google_secret_manager_secret_version.sentry_dsn_backend]
}

output "sentry_dsn_frontend_secret_id" {
  description = "Frontend Sentry DSN 在 Secret Manager 的 ID"
  value       = google_secret_manager_secret.sentry_dsn_frontend.secret_id
  depends_on  = [google_secret_manager_secret_version.sentry_dsn_frontend]
}
