# ----------------------------------------------------------------------
# storage: GCS bucket (meter photos)
#
# Design notes:
#   - Single region (asia-east1) to save cost
#   - External access goes through backend-issued V4 signed URLs (NOT public)
#   - Lifecycle: 90 days -> Nearline; 365 days -> Coldline
#   - Versioning disabled (meter photos do not need history)
# ----------------------------------------------------------------------

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

  # CORS: allow the web frontend to upload + preview
  cors {
    origin          = ["*"] # Tighten to your own domain before going to production
    method          = ["GET", "HEAD"]
    response_header = ["*"]
    max_age_seconds = 3600
  }
}
