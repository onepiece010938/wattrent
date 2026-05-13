variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "authorized_domains" {
  description = "Identity Platform 允許 OAuth redirect 的網域"
  type        = list(string)
}
