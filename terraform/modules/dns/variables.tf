variable "cloudflare_zone_id" {
  description = "Cloudflare zone ID"
  type        = string
}

variable "api_fqdn" {
  description = "API custom domain, e.g. api.wattrent.app"
  type        = string
}

variable "cloud_run_url" {
  description = "Cloud Run default URL (reserved for future health checks)"
  type        = string
}
