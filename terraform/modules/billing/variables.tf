variable "project_id" {
  description = "Target GCP project ID"
  type        = string
}

variable "project_number" {
  description = "Target GCP project number (used by the budget filter)"
  type        = string
}

variable "billing_account" {
  description = "Billing account ID (XXXXXX-XXXXXX-XXXXXX)"
  type        = string
}

variable "env" {
  description = "Environment name"
  type        = string
}

variable "region" {
  description = "Region for the Cloud Function / GCS source bucket"
  type        = string
  default     = "asia-east1"
}

variable "amount" {
  description = "Monthly budget amount (integer; currency is set by `currency`)"
  type        = number
}

variable "currency" {
  description = "Budget currency. Note: must match the billing account currency."
  type        = string
  default     = "USD"
}

variable "alert_thresholds" {
  description = "Notification threshold percentages (notify only, do NOT kill). The 100% kill threshold is added separately."
  type        = list(number)
  default     = [0.5, 0.9]
}

variable "enable_kill_switch" {
  description = "Whether reaching 100% should automatically disable billing (which shuts services down)."
  type        = bool
  default     = true
}

variable "notification_channels" {
  description = "Cloud Monitoring notification channel IDs (email/SMS/Slack...)"
  type        = list(string)
  default     = []
}

variable "labels" {
  description = "Resource labels"
  type        = map(string)
  default     = {}
}
