variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "github_repository" {
  description = "GitHub repo（owner/repo）；空字串會跳過 WIF binding"
  type        = string
  default     = ""
}

variable "cloud_run_service_name" {
  description = "要授權部署的 Cloud Run service 名稱（保留給未來縮窄權限用）"
  type        = string
}

variable "cloud_run_location" {
  description = "Cloud Run region"
  type        = string
}

variable "meters_bucket" {
  description = "電表照片 bucket 名稱（保留給未來縮窄權限用）"
  type        = string
}

variable "artifact_registry_repo" {
  description = "Artifact Registry repository（保留給未來縮窄權限用）"
  type        = string
}
