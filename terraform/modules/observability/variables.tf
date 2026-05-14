variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "env" {
  description = "Environment name"
  type        = string
}

variable "sentry_organization" {
  description = "Sentry organization slug"
  type        = string
}
