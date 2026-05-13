# ──────────────────────────────────────────────────────────────────────────
# 共用 locals
# ──────────────────────────────────────────────────────────────────────────

locals {
  # GCP project ID：staging → wattrent-staging；production → wattrent-prod
  gcp_project_id = (
    var.gcp_project_id != "" ? var.gcp_project_id :
    var.env == "production" ? "wattrent-prod" :
    "wattrent-${var.env}"
  )

  # GCS bucket 命名
  meters_bucket_name = "wattrent-meters-${var.env}"

  # Cloud Run service 名稱
  api_service_name = "wattrent-api"

  # API 完整網域：
  #   production → api.wattrent.app
  #   其他       → api.{env}.wattrent.app
  api_fqdn = (
    var.domain_root == "" ? "" :
    var.env == "production" ? "${var.api_subdomain}.${var.domain_root}" :
    "${var.api_subdomain}.${var.env}.${var.domain_root}"
  )

  # 共用 labels（GCP 只接受小寫、數字、`-` `_`）
  common_labels = merge(
    {
      app        = "wattrent"
      env        = var.env
      managed-by = "terraform"
    },
    var.extra_labels
  )

  # 啟用的 GCP API 清單
  enabled_apis = [
    "run.googleapis.com",                  # Cloud Run
    "firestore.googleapis.com",            # Firestore
    "storage.googleapis.com",              # Cloud Storage
    "secretmanager.googleapis.com",        # Secret Manager
    "aiplatform.googleapis.com",           # Vertex AI（AI_BACKEND=vertex 時使用）
    "generativelanguage.googleapis.com",   # Gemini Developer API（AI_BACKEND=gemini、供 AI Studio API key 所用）
    "identitytoolkit.googleapis.com",      # Identity Platform
    "iam.googleapis.com",                  # IAM
    "iamcredentials.googleapis.com",       # WIF token 簽發
    "cloudresourcemanager.googleapis.com", # 改 IAM 必須
    "compute.googleapis.com",              # cicd 模組讀 default compute SA + Cloud Run gen2 後端需要
    "artifactregistry.googleapis.com",     # 容器 registry
    "cloudbuild.googleapis.com",           # 給 gcloud run deploy --source 用
    "logging.googleapis.com",
    "monitoring.googleapis.com",
    # ─── billing kill switch ───
    "cloudbilling.googleapis.com",   # 取消 / 設定 project billing
    "billingbudgets.googleapis.com", # 建 budget
    "pubsub.googleapis.com",         # budget alert 出口
    "cloudfunctions.googleapis.com", # kill function
    "eventarc.googleapis.com",       # Pub/Sub → Function gen2 trigger
    # 註：functions gen2 底層用 run.googleapis.com，已在上面啟用
  ]
}
