# ----------------------------------------------------------------------
# cicd: GitHub Actions Workload Identity Federation
#
# Lets GitHub Actions exchange an OIDC token for a GCP access token, with no
# long-lived SA key required.
# Flow:
#   1. The GitHub Actions runner gets an OIDC token (containing repo / branch / actor info)
#   2. Exchange that token at sts.googleapis.com for a federated token
#   3. Use the federated token to impersonate the `github-actions@` SA
#   4. Use the SA access token to deploy
#
# In your workflow YAML:
#   permissions:
#     id-token: write
#   - uses: google-github-actions/auth@v2
#     with:
#       workload_identity_provider: ${{ outputs.workload_identity_provider }}
#       service_account: ${{ outputs.service_account_email }}
# ----------------------------------------------------------------------

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

  # GCP now requires attribute_condition; restrict the provider to tokens for the configured repo only.
  attribute_condition = "assertion.repository == \"${var.github_repository}\""

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

# --------- Deploy SA used by GitHub Actions ---------

resource "google_service_account" "deploy" {
  project      = var.project_id
  account_id   = "github-actions"
  display_name = "GitHub Actions deploy SA"
}

# Allow the GitHub repo (any branch) to impersonate this SA
resource "google_service_account_iam_member" "deploy_wif" {
  count              = var.github_repository != "" ? 1 : 0
  service_account_id = google_service_account.deploy.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github[0].name}/attribute.repository/${var.github_repository}"
}

# Cloud Run deployment
resource "google_project_iam_member" "deploy_run_developer" {
  project = var.project_id
  role    = "roles/run.developer"
  member  = "serviceAccount:${google_service_account.deploy.email}"
}

# Allow acting as the Cloud Run runtime SA (the runtime SA is created by the api module).
# Note: this binding lives in the cicd module and uses var.cloud_run_service_name to find it.
resource "google_project_iam_member" "deploy_act_as" {
  project = var.project_id
  role    = "roles/iam.serviceAccountUser"
  member  = "serviceAccount:${google_service_account.deploy.email}"
}

# Push images to Artifact Registry
resource "google_project_iam_member" "deploy_ar_writer" {
  project = var.project_id
  role    = "roles/artifactregistry.writer"
  member  = "serviceAccount:${google_service_account.deploy.email}"
}

# Deploy Firestore rules / indexes
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

# Write to Secret Manager (so CI can inject secret values)
resource "google_project_iam_member" "deploy_secret_manager" {
  project = var.project_id
  role    = "roles/secretmanager.admin"
  member  = "serviceAccount:${google_service_account.deploy.email}"
}
