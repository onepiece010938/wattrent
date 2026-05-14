variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "authorized_domains" {
  description = "Domains allowed for OAuth redirects in Identity Platform"
  type        = list(string)
}
