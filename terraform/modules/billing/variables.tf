variable "project_id" {
  description = "目標 GCP project ID"
  type        = string
}

variable "project_number" {
  description = "目標 GCP project number（建 budget filter 要用）"
  type        = string
}

variable "billing_account" {
  description = "Billing account ID（XXXXXX-XXXXXX-XXXXXX）"
  type        = string
}

variable "env" {
  description = "環境名稱"
  type        = string
}

variable "region" {
  description = "Cloud Function / GCS source bucket 的 region"
  type        = string
  default     = "asia-east1"
}

variable "amount" {
  description = "每月預算金額（整數，幣別由 currency 決定）"
  type        = number
}

variable "currency" {
  description = "預算幣別。注意：必須等於 billing account 的幣別"
  type        = string
  default     = "USD"
}

variable "alert_thresholds" {
  description = "通知 threshold 百分比（純通知，不會 kill）。kill switch 100% 是另外加的"
  type        = list(number)
  default     = [0.5, 0.9]
}

variable "enable_kill_switch" {
  description = "達到 100% 是否自動 disable billing（會關閉服務）"
  type        = bool
  default     = true
}

variable "notification_channels" {
  description = "Cloud Monitoring notification channel IDs（email/SMS/Slack...）"
  type        = list(string)
  default     = []
}

variable "labels" {
  description = "資源 labels"
  type        = map(string)
  default     = {}
}
