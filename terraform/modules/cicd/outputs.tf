output "workload_identity_provider" {
  description = "GitHub Actions 用的 WIF provider 完整名稱（github_repository 為空時為空字串）"
  value       = length(google_iam_workload_identity_pool_provider.github) > 0 ? google_iam_workload_identity_pool_provider.github[0].name : ""
}

output "workload_identity_pool" {
  description = "WIF pool 完整名稱（github_repository 為空時為空字串）"
  value       = length(google_iam_workload_identity_pool.github) > 0 ? google_iam_workload_identity_pool.github[0].name : ""
}

output "service_account_email" {
  description = "GitHub Actions impersonate 的 SA email"
  value       = google_service_account.deploy.email
}
