# ──────────────────────────────────────────────────────────────────────────
# api: Cloud Run + runtime SA + IAM + Artifact Registry
# ──────────────────────────────────────────────────────────────────────────

# ─────────── Artifact Registry（Docker image 倉庫） ───────────

resource "google_artifact_registry_repository" "wattrent" {
  project       = var.project_id
  location      = var.region
  repository_id = "wattrent"
  description   = "WattRent container images"
  format        = "DOCKER"
  labels        = var.labels

  cleanup_policies {
    id     = "keep-latest-10"
    action = "KEEP"
    most_recent_versions {
      keep_count = 10
    }
  }

  cleanup_policies {
    id     = "delete-old-untagged"
    action = "DELETE"
    condition {
      tag_state  = "UNTAGGED"
      older_than = "604800s" # 7 天
    }
  }
}

# ─────────── Cloud Run 執行身份 ───────────

resource "google_service_account" "run" {
  project      = var.project_id
  account_id   = "${var.service_name}-run"
  display_name = "Cloud Run runtime SA for ${var.service_name}"
}

# Firestore 讀寫
resource "google_project_iam_member" "run_firestore" {
  project = var.project_id
  role    = "roles/datastore.user"
  member  = "serviceAccount:${google_service_account.run.email}"
}

# GCS bucket 讀寫（只給這個 bucket）
resource "google_storage_bucket_iam_member" "run_meters" {
  bucket = var.meters_bucket
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.run.email}"
}

# Vertex AI 呼叫
resource "google_project_iam_member" "run_vertex" {
  project = var.project_id
  role    = "roles/aiplatform.user"
  member  = "serviceAccount:${google_service_account.run.email}"
}

# 簽 V4 signed URL（不需要額外 role，但要有 iam.serviceAccountTokenCreator on self）
resource "google_service_account_iam_member" "run_sign_self" {
  service_account_id = google_service_account.run.name
  role               = "roles/iam.serviceAccountTokenCreator"
  member             = "serviceAccount:${google_service_account.run.email}"
}

# Secret Manager 讀（只給有需要的 secret）
resource "google_secret_manager_secret_iam_member" "run_sentry_dsn" {
  count     = var.sentry_dsn_secret != "" ? 1 : 0
  project   = var.project_id
  secret_id = var.sentry_dsn_secret
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.run.email}"
}

# ─────────── Cloud Run service ───────────

resource "google_cloud_run_v2_service" "api" {
  project  = var.project_id
  name     = var.service_name
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL" # 之後可改 INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER

  # 預設是 true，會擋下 terraform destroy/replace。
  # 初期佈署需要能重建，等 production stable 後再打開。
  deletion_protection = false

  labels = var.labels

  template {
    service_account = google_service_account.run.email

    scaling {
      min_instance_count = var.min_instances
      max_instance_count = var.max_instances
    }

    timeout                          = "60s"
    execution_environment            = "EXECUTION_ENVIRONMENT_GEN2"
    max_instance_request_concurrency = 80

    containers {
      image = var.image

      ports {
        container_port = 8080
      }

      resources {
        limits = {
          cpu    = var.cpu
          memory = var.memory
        }
        cpu_idle          = true # scale-to-zero 期間不計費
        startup_cpu_boost = true
      }

      env {
        name  = "GCP_PROJECT_ID"
        value = var.project_id
      }
      env {
        name  = "GCP_REGION"
        value = var.region
      }
      env {
        name  = "METERS_BUCKET"
        value = var.meters_bucket
      }
      env {
        name  = "APP_ENV"
        value = var.env
      }
      env {
        name  = "API_FQDN"
        value = var.api_fqdn
      }

      dynamic "env" {
        for_each = var.sentry_dsn_secret != "" ? [1] : []
        content {
          name = "SENTRY_DSN"
          value_source {
            secret_key_ref {
              secret  = var.sentry_dsn_secret
              version = "latest"
            }
          }
        }
      }

      startup_probe {
        http_get {
          path = "/health"
        }
        initial_delay_seconds = 0
        period_seconds        = 5
        timeout_seconds       = 3
        failure_threshold     = 5
      }

      liveness_probe {
        http_get {
          path = "/health"
        }
        period_seconds    = 30
        timeout_seconds   = 5
        failure_threshold = 3
      }
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }

  # CI/CD 會頻繁更新 image tag，避免 TF 把它 revert
  lifecycle {
    ignore_changes = [
      template[0].containers[0].image,
      # Cloud Run 內部會把 env 順序正規化（特別是 dynamic + secret_key_ref 同時出現時），
      # 為了避免 TF 永遠偵測 drift → 觸發新 revision 的迴圈，env 列表交給人工管理。
      # 要新增/修改 env var 時，先在 TF code 改完，再到 console 手動加上去（或臨時拿掉這行）。
      template[0].containers[0].env,
      client,
      client_version,
    ]
  }

  depends_on = [
    google_storage_bucket_iam_member.run_meters,
    google_project_iam_member.run_firestore,
    google_project_iam_member.run_vertex,
  ]
}

# ─────────── 對外開放（暫時 allUsers，正式環境建議改成 ID token 驗證） ───────────

resource "google_cloud_run_v2_service_iam_member" "public_invoker" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.api.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# ─────────── Cloud Run domain mapping（自訂網域） ───────────

resource "google_cloud_run_domain_mapping" "api" {
  count    = var.api_fqdn != "" ? 1 : 0
  provider = google-beta # domain mapping 仍在 beta

  project  = var.project_id
  location = var.region
  name     = var.api_fqdn

  metadata {
    namespace = var.project_id
  }

  spec {
    route_name = google_cloud_run_v2_service.api.name
  }

  depends_on = [google_cloud_run_v2_service.api]
}
