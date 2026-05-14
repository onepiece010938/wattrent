output "backend_project_slug" {
  description = "Sentry backend project slug"
  value       = sentry_project.backend.slug
}

output "frontend_project_slug" {
  description = "Sentry frontend project slug"
  value       = sentry_project.frontend.slug
}

output "sentry_dsn_secret_id" {
  description = "Secret Manager ID for the backend Sentry DSN"
  value       = google_secret_manager_secret.sentry_dsn_backend.secret_id
  # Make sure downstream (Cloud Run) only references `latest` after the secret_version is actually written
  depends_on = [google_secret_manager_secret_version.sentry_dsn_backend]
}

output "sentry_dsn_frontend_secret_id" {
  description = "Secret Manager ID for the frontend Sentry DSN"
  value       = google_secret_manager_secret.sentry_dsn_frontend.secret_id
  depends_on  = [google_secret_manager_secret_version.sentry_dsn_frontend]
}
