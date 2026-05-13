output "enabled_apis" {
  description = "已啟用的 API"
  value       = [for s in google_project_service.this : s.service]
}
