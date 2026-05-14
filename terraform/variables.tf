# ──────────────────────────────────────────────────────────────────────────
# Top-level input variables
#
# Most values come from envs/{env}.tfvars; this file only declares types and defaults.
# ──────────────────────────────────────────────────────────────────────────

variable "env" {
  description = "Environment name: staging / production / preview-{prNumber}"
  type        = string
  validation {
    condition     = can(regex("^(staging|production|preview-[0-9]+)$", var.env))
    error_message = "env must be staging, production, or preview-{number}"
  }
}

variable "gcp_project_id" {
  description = "GCP project ID. If empty, locals derives it from var.env (wattrent-{env})."
  type        = string
  default     = ""
}

variable "gcp_billing_account" {
  description = "GCP Billing Account ID (XXXXXX-XXXXXX-XXXXXX). Required by both the billing module and Identity Platform."
  type        = string
  sensitive   = true
  validation {
    condition     = can(regex("^[0-9A-F]{6}-[0-9A-F]{6}-[0-9A-F]{6}$", var.gcp_billing_account))
    error_message = "Format must be XXXXXX-XXXXXX-XXXXXX (three groups of 6 hex chars)"
  }
}

variable "gcp_region" {
  description = "Primary GCP region; Cloud Run, Firestore, GCS, and Vertex AI all run here."
  type        = string
  default     = "asia-east1"
}

variable "gcp_storage_location" {
  description = "GCS bucket location; single-region is cheaper than multi-region."
  type        = string
  default     = "ASIA-EAST1"
}

# ─────────────── AI / OCR ───────────────

variable "ai_backend" {
  description = "OCR backend: gemini (default, Google AI Studio free tier) or vertex (Vertex AI; paid; uses IAM)."
  type        = string
  default     = "gemini"
  validation {
    condition     = contains(["gemini", "vertex"], var.ai_backend)
    error_message = "ai_backend must be gemini or vertex"
  }
}

variable "gemini_model" {
  description = "Gemini model name (shared by both backends)."
  type        = string
  default     = "gemini-2.5-flash-lite"
}

# ─────────────── Cloud Run ───────────────

variable "api_image" {
  description = "Cloud Run container image. The first deploy can use a placeholder (e.g. gcr.io/cloudrun/hello); subsequent CI/CD image pushes are absorbed by lifecycle.ignore_changes inside the module so TF does not bounce."
  type        = string
  default     = "gcr.io/cloudrun/hello"
}

variable "api_min_instances" {
  description = "Cloud Run min instance count; 0 = scale-to-zero (incurs cold starts)."
  type        = number
  default     = 0
}

variable "api_max_instances" {
  description = "Cloud Run max instance count; excess requests queue."
  type        = number
  default     = 10
}

variable "api_cpu" {
  description = "Cloud Run CPU allocation (vCPU)."
  type        = string
  default     = "1"
}

variable "api_memory" {
  description = "Cloud Run memory allocation."
  type        = string
  default     = "512Mi"
}

# ─────────────── Domain / DNS ───────────────

variable "domain_root" {
  description = "Root domain, e.g. wattrent.app."
  type        = string
  default     = ""
}

variable "api_subdomain" {
  description = "API subdomain. Composed as api.{env}.{domain_root} (production drops the env segment)."
  type        = string
  default     = "api"
}

variable "cloudflare_zone_id" {
  description = "Cloudflare zone ID (the domain must already be in your Cloudflare account)."
  type        = string
  default     = ""
}

# ─────────────── Auth ───────────────

variable "auth_authorized_domains" {
  description = "Domains allowed for OAuth redirects in Identity Platform."
  type        = list(string)
  default     = ["localhost"]
}

# ─────────────── CI/CD ───────────────

variable "github_repository" {
  description = "GitHub repo (owner/repo) used by Workload Identity Federation."
  type        = string
  default     = ""
}

# ─────────────── Observability ───────────────

variable "sentry_organization" {
  description = "Sentry organization slug"
  type        = string
  default     = ""
}

variable "enable_sentry" {
  description = "Whether to create the Sentry project."
  type        = bool
  default     = false
}

# ─────────────── Billing / budget cap (kill switch) ───────────────

variable "billing_budget_amount" {
  description = "Monthly budget cap (integer). Hitting 100% disables billing automatically, taking the entire project offline to prevent further charges."
  type        = number
  default     = 10
  validation {
    condition     = var.billing_budget_amount > 0
    error_message = "Budget must be > 0; if you do not want a budget, set billing_kill_switch_enabled=false and raise the budget instead."
  }
}

variable "billing_budget_currency" {
  description = "Budget currency. Must match the currency configured on the billing account."
  type        = string
  default     = "USD"
}

variable "billing_alert_thresholds" {
  description = "Notify-only thresholds (decimal, 0.5 = 50%). 100% is added automatically; do not list it here."
  type        = list(number)
  default     = [0.5, 0.9]
}

variable "billing_kill_switch_enabled" {
  description = "When true, hitting 100% disables billing automatically → every paid service returns 503. When false, only an email is sent."
  type        = bool
  default     = true
}

variable "billing_notification_channels" {
  description = "Extra Cloud Monitoring notification channels (email/SMS/Slack). An empty list means use only the billing account's default email."
  type        = list(string)
  default     = []
}

# ─────────────── Common labels ───────────────

variable "extra_labels" {
  description = "Applied to every resource that supports labels."
  type        = map(string)
  default     = {}
}
