variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "Cloud Run / Artifact Registry region"
  type        = string
}

variable "service_name" {
  description = "Cloud Run service 名稱"
  type        = string
}

variable "image" {
  description = "Container image full path with tag"
  type        = string
}

variable "min_instances" {
  description = "最小執行個體數（0 = scale-to-zero）"
  type        = number
  default     = 0
}

variable "max_instances" {
  description = "最大執行個體數"
  type        = number
  default     = 10
}

variable "cpu" {
  description = "Cloud Run vCPU 配額"
  type        = string
  default     = "1"
}

variable "memory" {
  description = "Cloud Run 記憶體配額"
  type        = string
  default     = "512Mi"
}

variable "env" {
  description = "環境名稱（傳給 container 當 APP_ENV）"
  type        = string
}

variable "api_fqdn" {
  description = "API 自訂網域（給 domain mapping 用）；空字串代表不設"
  type        = string
  default     = ""
}

variable "meters_bucket" {
  description = "電表照片 GCS bucket 名稱"
  type        = string
}

variable "sentry_dsn_secret" {
  description = "Sentry DSN 在 Secret Manager 的 secret ID；空字串代表不掛載"
  type        = string
  default     = ""
}

variable "ai_backend" {
  description = "AI 後端：gemini（AI Studio API key）或 vertex（Vertex AI，走 IAM）"
  type        = string
  default     = "gemini"
}

variable "gemini_model" {
  description = "Gemini 模型名"
  type        = string
  default     = "gemini-2.5-flash-lite"
}

variable "labels" {
  description = "資源 labels"
  type        = map(string)
  default     = {}
}
