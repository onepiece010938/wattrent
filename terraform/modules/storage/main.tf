# ──────────────────────────────────────────────────────────────────────────
# storage: GCS bucket（電表照片）
#
# 設計重點：
#   - Single region（asia-east1）省成本
#   - 對外存取走後端簽 V4 signed URL（不開 public）
#   - Lifecycle：90 天 → Nearline；365 天 → Coldline
#   - Versioning 關閉（電表照片不需要歷史版本）
# ──────────────────────────────────────────────────────────────────────────

resource "google_storage_bucket" "meters" {
  project  = var.project_id
  name     = var.bucket_name
  location = var.location

  storage_class = "STANDARD"
  labels        = var.labels

  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"

  versioning {
    enabled = false
  }

  lifecycle_rule {
    condition {
      age = 90
    }
    action {
      type          = "SetStorageClass"
      storage_class = "NEARLINE"
    }
  }

  lifecycle_rule {
    condition {
      age = 365
    }
    action {
      type          = "SetStorageClass"
      storage_class = "COLDLINE"
    }
  }

  # CORS：給前端 web 上傳預覽
  cors {
    origin          = ["*"] # 上線前縮成自家 domain
    method          = ["GET", "HEAD"]
    response_header = ["*"]
    max_age_seconds = 3600
  }
}
