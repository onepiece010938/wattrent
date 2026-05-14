# ──────────────────────────────────────────────────────────────────────────
# Shared locals
# ──────────────────────────────────────────────────────────────────────────

locals {
  # GCP project ID: staging → wattrent-staging; production → wattrent-prod.
  gcp_project_id = (
    var.gcp_project_id != "" ? var.gcp_project_id :
    var.env == "production" ? "wattrent-prod" :
    "wattrent-${var.env}"
  )

  # GCS bucket name.
  meters_bucket_name = "wattrent-meters-${var.env}"

  # Cloud Run service name.
  api_service_name = "wattrent-api"

  # Full API hostname:
  #   production → api.wattrent.app
  #   other      → api.{env}.wattrent.app
  api_fqdn = (
    var.domain_root == "" ? "" :
    var.env == "production" ? "${var.api_subdomain}.${var.domain_root}" :
    "${var.api_subdomain}.${var.env}.${var.domain_root}"
  )

  # Common labels (GCP only accepts lowercase, digits, `-`, and `_`).
  common_labels = merge(
    {
      app        = "wattrent"
      env        = var.env
      managed-by = "terraform"
    },
    var.extra_labels
  )

  # GCP APIs that need to be enabled.
  enabled_apis = [
    "run.googleapis.com",                  # Cloud Run
    "firestore.googleapis.com",            # Firestore
    "storage.googleapis.com",              # Cloud Storage
    "secretmanager.googleapis.com",        # Secret Manager
    "aiplatform.googleapis.com",           # Vertex AI (used when AI_BACKEND=vertex)
    "generativelanguage.googleapis.com",   # Gemini Developer API (used by AI_BACKEND=gemini with an AI Studio API key)
    "identitytoolkit.googleapis.com",      # Identity Platform
    "iam.googleapis.com",                  # IAM
    "iamcredentials.googleapis.com",       # WIF token issuance
    "cloudresourcemanager.googleapis.com", # Required to modify IAM
    "compute.googleapis.com",              # cicd module reads the default compute SA, and Cloud Run gen2 backend needs it
    "artifactregistry.googleapis.com",     # Container registry
    "cloudbuild.googleapis.com",           # Used by gcloud run deploy --source
    "logging.googleapis.com",
    "monitoring.googleapis.com",
    # ─── billing kill switch ───
    "cloudbilling.googleapis.com",   # Disable / configure project billing
    "billingbudgets.googleapis.com", # Create the budget
    "pubsub.googleapis.com",         # Budget alert delivery channel
    "cloudfunctions.googleapis.com", # The kill function
    "eventarc.googleapis.com",       # Pub/Sub → Function gen2 trigger
    # Note: gen2 functions run on top of run.googleapis.com, which is already enabled above.
  ]
}
