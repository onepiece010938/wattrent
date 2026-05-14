# ──────────────────────────────────────────────────────────────────────────
# api: Cloud Run + runtime SA + IAM + Artifact Registry
# ──────────────────────────────────────────────────────────────────────────

# --------- Artifact Registry (Docker image repository) ---------

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
      older_than = "604800s" # 7 days
    }
  }
}

# --------- Cloud Run runtime identity ---------

resource "google_service_account" "run" {
  project      = var.project_id
  account_id   = "${var.service_name}-run"
  display_name = "Cloud Run runtime SA for ${var.service_name}"
}

# Firestore read/write
resource "google_project_iam_member" "run_firestore" {
  project = var.project_id
  role    = "roles/datastore.user"
  member  = "serviceAccount:${google_service_account.run.email}"
}

# GCS bucket read/write (only this bucket)
resource "google_storage_bucket_iam_member" "run_meters" {
  bucket = var.meters_bucket
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.run.email}"
}

# Vertex AI calls (only required when AI_BACKEND=vertex; AI_BACKEND=gemini uses an AI Studio API key and does NOT need this IAM).
# To allow toggling backend in the console without re-running terraform apply, this binding is granted unconditionally (no count).
resource "google_project_iam_member" "run_vertex" {
  project = var.project_id
  role    = "roles/aiplatform.user"
  member  = "serviceAccount:${google_service_account.run.email}"
}

# --------- Gemini API key Secret (used when AI_BACKEND=gemini) ---------
# Terraform only creates the secret container; obtain the actual key value from
# https://aistudio.google.com/apikey and run
# `gcloud secrets versions add wattrent-gemini-api-key --data-file=-` manually.
resource "google_secret_manager_secret" "gemini_api_key" {
  count     = var.ai_backend == "gemini" ? 1 : 0
  project   = var.project_id
  secret_id = "${var.service_name}-gemini-api-key"
  labels    = var.labels

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_iam_member" "run_gemini_api_key" {
  count     = var.ai_backend == "gemini" ? 1 : 0
  project   = var.project_id
  secret_id = google_secret_manager_secret.gemini_api_key[0].secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.run.email}"
}

# Sign V4 signed URLs (no extra role needed, but requires iam.serviceAccountTokenCreator on self)
resource "google_service_account_iam_member" "run_sign_self" {
  service_account_id = google_service_account.run.name
  role               = "roles/iam.serviceAccountTokenCreator"
  member             = "serviceAccount:${google_service_account.run.email}"
}

# Read from Secret Manager (only the secrets that are needed)
resource "google_secret_manager_secret_iam_member" "run_sentry_dsn" {
  count     = var.sentry_dsn_secret != "" ? 1 : 0
  project   = var.project_id
  secret_id = var.sentry_dsn_secret
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.run.email}"
}

# --------- Cloud Run service ---------

resource "google_cloud_run_v2_service" "api" {
  project  = var.project_id
  name     = var.service_name
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL" # Switch to INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER later

  # Defaults to true, which blocks terraform destroy/replace.
  # Initial deploys need to be able to recreate; turn this on once production is stable.
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
        cpu_idle          = true # Not billed during scale-to-zero
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
      env {
        name  = "AI_BACKEND"
        value = var.ai_backend
      }
      env {
        name  = "GEMINI_MODEL"
        value = var.gemini_model
      }

      dynamic "env" {
        for_each = var.ai_backend == "gemini" ? [1] : []
        content {
          name = "GEMINI_API_KEY"
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.gemini_api_key[0].secret_id
              version = "latest"
            }
          }
        }
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

  # CI/CD frequently updates the image tag; do not let TF revert it.
  # env vars ARE managed by TF (including the new GEMINI_API_KEY/AI_BACKEND/GEMINI_MODEL);
  # do NOT ignore them, otherwise Cloud Run won't pick up the new env.
  lifecycle {
    ignore_changes = [
      template[0].containers[0].image,
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

# --------- Public access (allUsers for now; for production switch to ID token validation) ---------

resource "google_cloud_run_v2_service_iam_member" "public_invoker" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.api.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# --------- Cloud Run domain mapping (custom domain) ---------

resource "google_cloud_run_domain_mapping" "api" {
  count    = var.api_fqdn != "" ? 1 : 0
  provider = google-beta # domain mapping is still in beta

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
