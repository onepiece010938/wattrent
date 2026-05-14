output "workload_identity_provider" {
  description = "Full WIF provider name used by GitHub Actions (empty string when github_repository is empty)"
  value       = length(google_iam_workload_identity_pool_provider.github) > 0 ? google_iam_workload_identity_pool_provider.github[0].name : ""
}

output "workload_identity_pool" {
  description = "Full WIF pool name (empty string when github_repository is empty)"
  value       = length(google_iam_workload_identity_pool.github) > 0 ? google_iam_workload_identity_pool.github[0].name : ""
}

output "service_account_email" {
  description = "SA email that GitHub Actions impersonates"
  value       = google_service_account.deploy.email
}
