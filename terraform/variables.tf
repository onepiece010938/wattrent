# ──────────────────────────────────────────────────────────────────────────
# 頂層輸入變數
#
# 大多數值由 envs/{env}.tfvars 提供；這裡只放型別與 default
# ──────────────────────────────────────────────────────────────────────────

variable "env" {
  description = "環境名稱：staging / production / preview-{prNumber}"
  type        = string
  validation {
    condition     = can(regex("^(staging|production|preview-[0-9]+)$", var.env))
    error_message = "env 必須是 staging、production，或 preview-{number}"
  }
}

variable "gcp_project_id" {
  description = "GCP project ID。為空則由 locals 用 var.env 組合（wattrent-{env}）"
  type        = string
  default     = ""
}

variable "gcp_billing_account" {
  description = "GCP Billing Account ID（XXXXXX-XXXXXX-XXXXXX）。billing module + Identity Platform 都會用到，必填"
  type        = string
  sensitive   = true
  validation {
    condition     = can(regex("^[0-9A-F]{6}-[0-9A-F]{6}-[0-9A-F]{6}$", var.gcp_billing_account))
    error_message = "格式必須是 XXXXXX-XXXXXX-XXXXXX（六碼 hex 三段）"
  }
}

variable "gcp_region" {
  description = "GCP 主要 region；Cloud Run、Firestore、GCS、Vertex AI 都跑這個"
  type        = string
  default     = "asia-east1"
}

variable "gcp_storage_location" {
  description = "GCS bucket location；single-region 比 multi-region 便宜"
  type        = string
  default     = "ASIA-EAST1"
}

# ─────────────── Cloud Run ───────────────

variable "api_image" {
  description = "Cloud Run container image。首次佈署可以給 placeholder（例 gcr.io/cloudrun/hello），之後 CI/CD push image 時 module 中 lifecycle.ignore_changes 會讓 TF 不反覆。"
  type        = string
  default     = "gcr.io/cloudrun/hello"
}

variable "api_min_instances" {
  description = "Cloud Run 最小執行個體數；0 = scale to zero（會有 cold start）"
  type        = number
  default     = 0
}

variable "api_max_instances" {
  description = "Cloud Run 最大執行個體數；超過會排隊"
  type        = number
  default     = 10
}

variable "api_cpu" {
  description = "Cloud Run CPU 配額（vCPU）"
  type        = string
  default     = "1"
}

variable "api_memory" {
  description = "Cloud Run 記憶體配額"
  type        = string
  default     = "512Mi"
}

# ─────────────── Domain / DNS ───────────────

variable "domain_root" {
  description = "根網域，例：wattrent.app"
  type        = string
  default     = ""
}

variable "api_subdomain" {
  description = "API 子網域，會組成 api.{env}.{domain_root}（production 不加 env）"
  type        = string
  default     = "api"
}

variable "cloudflare_zone_id" {
  description = "Cloudflare zone ID（網域已加入 CF 帳號）"
  type        = string
  default     = ""
}

# ─────────────── Auth ───────────────

variable "auth_authorized_domains" {
  description = "Identity Platform 允許的 OAuth redirect 網域"
  type        = list(string)
  default     = ["localhost"]
}

# ─────────────── CI/CD ───────────────

variable "github_repository" {
  description = "GitHub repo（owner/repo），給 Workload Identity Federation 用"
  type        = string
  default     = ""
}

# ─────────────── Observability ───────────────

variable "sentry_organization" {
  description = "Sentry organization slug"
  type        = string
  default     = ""
}

variable "enable_sentry" {
  description = "是否建立 Sentry project"
  type        = bool
  default     = false
}

# ─────────────── Billing / 預算上限（kill switch） ───────────────

variable "billing_budget_amount" {
  description = "每月預算上限金額（整數）。達到 100% 會自動 disable billing，整個 project 服務停擺，避免被多收錢"
  type        = number
  default     = 10
  validation {
    condition     = var.billing_budget_amount > 0
    error_message = "預算必須 > 0；如不想用 budget，請設 billing_kill_switch_enabled=false 並把 budget 拉高"
  }
}

variable "billing_budget_currency" {
  description = "預算幣別。必須等於 billing account 設定的幣別"
  type        = string
  default     = "USD"
}

variable "billing_alert_thresholds" {
  description = "純通知 threshold（小數，0.5 = 50%）。100% 會自動加，不用列"
  type        = list(number)
  default     = [0.5, 0.9]
}

variable "billing_kill_switch_enabled" {
  description = "true 時達到 100% 自動停 billing → 所有付費服務 503。false 只發 email"
  type        = bool
  default     = true
}

variable "billing_notification_channels" {
  description = "額外的 Cloud Monitoring notification channel（email/SMS/Slack）。空陣列代表只用 billing account 預設 email"
  type        = list(string)
  default     = []
}

# ─────────────── 共用 labels ───────────────

variable "extra_labels" {
  description = "套用到所有支援 labels 的資源"
  type        = map(string)
  default     = {}
}
