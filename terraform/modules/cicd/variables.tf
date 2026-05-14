variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "github_repository" {
  description = "GitHub repo (owner/repo); empty string skips the WIF binding"
  type        = string
  default     = ""
}

variable "cloud_run_service_name" {
  description = "Cloud Run service name to authorize for deployment (reserved for future least-privilege scoping)"
  type        = string
}

variable "cloud_run_location" {
  description = "Cloud Run region"
  type        = string
}

variable "meters_bucket" {
  description = "Meter photo bucket name (reserved for future least-privilege scoping)"
  type        = string
}

variable "artifact_registry_repo" {
  description = "Artifact Registry repository (reserved for future least-privilege scoping)"
  type        = string
}
