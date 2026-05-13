variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "bucket_name" {
  description = "GCS bucket 名稱（全域唯一）"
  type        = string
}

variable "location" {
  description = "Bucket 位置；建議 single-region 省錢"
  type        = string
}

variable "labels" {
  description = "Bucket labels"
  type        = map(string)
  default     = {}
}
