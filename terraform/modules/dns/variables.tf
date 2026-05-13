variable "cloudflare_zone_id" {
  description = "Cloudflare zone ID"
  type        = string
}

variable "api_fqdn" {
  description = "API 自訂網域，例：api.wattrent.app"
  type        = string
}

variable "cloud_run_url" {
  description = "Cloud Run 預設 URL（保留給未來健康檢查用）"
  type        = string
}
