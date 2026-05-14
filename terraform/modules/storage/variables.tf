variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "bucket_name" {
  description = "GCS bucket name (must be globally unique)"
  type        = string
}

variable "location" {
  description = "Bucket location; single-region recommended for cost"
  type        = string
}

variable "labels" {
  description = "Bucket labels"
  type        = map(string)
  default     = {}
}
