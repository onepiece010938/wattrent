variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "Cloud Run / Artifact Registry region"
  type        = string
}

variable "service_name" {
  description = "Cloud Run service name"
  type        = string
}

variable "image" {
  description = "Container image full path with tag"
  type        = string
}

variable "min_instances" {
  description = "Minimum number of instances (0 = scale-to-zero)"
  type        = number
  default     = 0
}

variable "max_instances" {
  description = "Maximum number of instances"
  type        = number
  default     = 10
}

variable "cpu" {
  description = "Cloud Run vCPU allocation"
  type        = string
  default     = "1"
}

variable "memory" {
  description = "Cloud Run memory allocation"
  type        = string
  default     = "512Mi"
}

variable "env" {
  description = "Environment name (passed to the container as APP_ENV)"
  type        = string
}

variable "api_fqdn" {
  description = "API custom domain (used by domain mapping); empty string means none"
  type        = string
  default     = ""
}

variable "meters_bucket" {
  description = "GCS bucket name for meter photos"
  type        = string
}

variable "sentry_dsn_secret" {
  description = "Secret ID of the Sentry DSN in Secret Manager; empty string skips the mount"
  type        = string
  default     = ""
}

variable "ai_backend" {
  description = "AI backend: gemini (AI Studio API key) or vertex (Vertex AI, IAM-based)"
  type        = string
  default     = "gemini"
}

variable "gemini_model" {
  description = "Gemini model name"
  type        = string
  default     = "gemini-2.5-flash-lite"
}

variable "labels" {
  description = "Resource labels"
  type        = map(string)
  default     = {}
}
