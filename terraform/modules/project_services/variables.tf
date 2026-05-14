variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "apis" {
  description = "List of API names to enable"
  type        = list(string)
}
