output "budget_id" {
  description = "Billing budget resource ID"
  value       = google_billing_budget.monthly.id
}

output "pubsub_topic" {
  description = "Budget alert Pub/Sub topic"
  value       = google_pubsub_topic.budget.id
}

output "killer_function_name" {
  description = "Kill-switch Cloud Function name (empty when disabled)"
  value       = var.enable_kill_switch ? google_cloudfunctions2_function.killer[0].name : ""
}

output "killer_service_account" {
  description = "Kill-switch SA email"
  value       = var.enable_kill_switch ? google_service_account.killer[0].email : ""
}
