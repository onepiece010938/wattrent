output "enabled_apis" {
  description = "Enabled APIs"
  value       = [for s in google_project_service.this : s.service]
}
