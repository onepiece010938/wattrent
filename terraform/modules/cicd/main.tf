# ──────────────────────────────────────────────────────────────────────────
# cicd: GitHub Actions Workload Identity Federation
#
# 讓 GitHub Actions 用 OIDC token 換 GCP access token，無需 long-lived SA key。
# 流程：
#   1. GitHub Actions runner 拿 OIDC token（含 repo / branch / actor 資訊）
#   2. 拿這 token 去 sts.googleapis.com 換 federated token
#   3. 用 federated token 去 impersonate `github-actions@` SA
#   4. 拿 SA access token 來部署
#
# 在 workflow YAML 寫：
#   permissions:
#     id-token: write
#   - uses: google-github-actions/auth@v2
#     with:
#       workload_identity_provider: ${{ outputs.workload_identity_provider }}
#       service_account: ${{ outputs.service_account_email }}
# ──────────────────────────────────────────────────────────────────────────

resource "google_iam_workload_identity_pool" "github" {
  count                     = var.github_repository != "" ? 1 : 0
  project                   = var.project_id
  workload_identity_pool_id = "github-pool"
  display_name              = "GitHub Actions"
  description               = "WIF pool for GitHub Actions OIDC"
}

resource "google_iam_workload_identity_pool_provider" "github" {
  count                              = var.github_repository != "" ? 1 : 0
  project                            = var.project_id
  workload_identity_pool_id          = google_iam_workload_identity_pool.github[0].workload_identity_pool_id
  workload_identity_pool_provider_id = "github-provider"
  display_name                       = "GitHub OIDC"

  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.actor"      = "assertion.actor"
    "attribute.repository" = "assertion.repository"
    "attribute.ref"        = "assertion.ref"
    "attribute.event_name" = "assertion.event_name"
  }

  # GCP 現在必須寫 attribute_condition；限定只接受指定 repo 的 token。
  attribute_condition = "assertion.repository == \"${var.github_repository}\""

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

# ─────────── GitHub Actions 用的 deploy SA ───────────

resource "google_service_account" "deploy" {
  project      = var.project_id
  account_id   = "github-actions"
  display_name = "GitHub Actions deploy SA"
}

# 允許 GitHub repo（任何 branch）impersonate 這個 SA
resource "google_service_account_iam_member" "deploy_wif" {
  count              = var.github_repository != "" ? 1 : 0
  service_account_id = google_service_account.deploy.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github[0].name}/attribute.repository/${var.github_repository}"
}

# Cloud Run 部署
resource "google_project_iam_member" "deploy_run_developer" {
  project = var.project_id
  role    = "roles/run.developer"
  member  = "serviceAccount:${google_service_account.deploy.email}"
}

# 允許用 Cloud Run runtime SA（runtime SA 由 api module 建立）
# 注意：這裡的 binding 寫在 cicd module 裡，要靠 var.cloud_run_service_name 取得
resource "google_project_iam_member" "deploy_act_as" {
  project = var.project_id
  role    = "roles/iam.serviceAccountUser"
  member  = "serviceAccount:${google_service_account.deploy.email}"
}

# Push image 到 Artifact Registry
resource "google_project_iam_member" "deploy_ar_writer" {
  project = var.project_id
  role    = "roles/artifactregistry.writer"
  member  = "serviceAccount:${google_service_account.deploy.email}"
}

# 部署 Firestore rules / indexes
resource "google_project_iam_member" "deploy_firestore" {
  project = var.project_id
  role    = "roles/datastore.indexAdmin"
  member  = "serviceAccount:${google_service_account.deploy.email}"
}

resource "google_project_iam_member" "deploy_firebase_admin" {
  project = var.project_id
  role    = "roles/firebaserules.admin"
  member  = "serviceAccount:${google_service_account.deploy.email}"
}

# Secret Manager 寫入（給 CI 注入 secret value 用）
resource "google_project_iam_member" "deploy_secret_manager" {
  project = var.project_id
  role    = "roles/secretmanager.admin"
  member  = "serviceAccount:${google_service_account.deploy.email}"
}
