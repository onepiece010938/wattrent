variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "apis" {
  description = "要啟用的 API 名稱清單"
  type        = list(string)
}
