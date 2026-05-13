variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "location" {
  description = "Firestore location（一旦建立不可變）"
  type        = string
}

variable "labels" {
  description = "Labels（Firestore database resource 不支援 labels，此欄位保留給未來相容）"
  type        = map(string)
  default     = {}
}
