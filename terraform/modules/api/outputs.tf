output "service_name" {
  description = "Cloud Run service 名稱"
  value       = google_cloud_run_v2_service.api.name
}

output "service_url" {
  description = "Cloud Run 預設 URL（*.run.app）"
  value       = google_cloud_run_v2_service.api.uri
}

output "service_account_email" {
  description = "Cloud Run runtime SA email"
  value       = google_service_account.run.email
}

output "artifact_registry_repo" {
  description = "Artifact Registry repository（Docker push 目標）"
  value       = "${google_artifact_registry_repository.wattrent.location}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.wattrent.repository_id}"
}
