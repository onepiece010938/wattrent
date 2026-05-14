# ──────────────────────────────────────────────────────────────────────────
# billing: budget cap + automatic shutdown (kill switch)
#
# Why this is needed:
#   GCP has no built-in "stop service when budget is hit" switch -- only alert emails.
#   The officially recommended pattern:
#     1. Define a budget -> send a message to Pub/Sub when a threshold is hit
#     2. A Cloud Function subscribes to Pub/Sub and calls the Cloud Billing API
#        to unset the project's billing account
#     3. Once billing is disabled, Cloud Run / Firestore writes / Vertex AI start refusing requests immediately
#
# Side effects (you should be aware):
#   - After billing is disabled, Cloud Run starts returning 503 within ~5 minutes; Firestore enters read-only-cache mode
#   - After billing is reattached, services come back and data is not lost (except for Vertex AI in-flight requests)
#   - This is a HARD cap, much safer than alert-only
#
# Reference: https://cloud.google.com/billing/docs/how-to/disable-billing-with-notifications
# ──────────────────────────────────────────────────────────────────────────

# --------------- Pub/Sub topic (budget alert sink) ---------------

resource "google_pubsub_topic" "budget" {
  project = var.project_id
  name    = "billing-budget-alerts"
  labels  = var.labels
}

# --------------- Budget itself ---------------

resource "google_billing_budget" "monthly" {
  billing_account = var.billing_account
  display_name    = "${var.env} monthly budget"

  budget_filter {
    projects               = ["projects/${var.project_number}"]
    credit_types_treatment = "INCLUDE_ALL_CREDITS"
    calendar_period        = "MONTH"
  }

  amount {
    specified_amount {
      currency_code = var.currency
      units         = tostring(var.amount)
    }
  }

  # Multi-stage thresholds: 50%/90% notify only, 100% triggers the kill function
  dynamic "threshold_rules" {
    for_each = var.alert_thresholds
    content {
      threshold_percent = threshold_rules.value
      spend_basis       = "CURRENT_SPEND"
    }
  }

  # Add an extra 100% threshold (used by the kill switch)
  threshold_rules {
    threshold_percent = 1.0
    spend_basis       = "CURRENT_SPEND"
  }

  # Also add a 100% forecasted threshold to get a heads-up a day or two earlier
  threshold_rules {
    threshold_percent = 1.0
    spend_basis       = "FORECASTED_SPEND"
  }

  all_updates_rule {
    pubsub_topic                     = google_pubsub_topic.budget.id
    schema_version                   = "1.0"
    disable_default_iam_recipients   = false
    monitoring_notification_channels = var.notification_channels
  }
}

# --------------- Service account used by the kill function ---------------

resource "google_service_account" "killer" {
  count        = var.enable_kill_switch ? 1 : 0
  project      = var.project_id
  account_id   = "billing-killer"
  display_name = "Budget kill-switch function"
  description  = "Disables project billing when monthly budget exceeded"
}

# To detach a project from its billing account, the function SA needs the
# billing.resourceAssociations.delete permission at the billing-account level.
# That permission only exists in roles/billing.admin (roles/billing.user can
# link but NOT unlink).
# Warning: roles/billing.admin is essentially full control over the billing
# account; once usage grows, consider a custom role to tighten this down.
resource "google_billing_account_iam_member" "killer_billing_user" {
  count              = var.enable_kill_switch ? 1 : 0
  billing_account_id = var.billing_account
  role               = "roles/billing.admin"
  member             = "serviceAccount:${google_service_account.killer[0].email}"
}

# Allow the function SA to read the project (avoids NotFound)
resource "google_project_iam_member" "killer_viewer" {
  count   = var.enable_kill_switch ? 1 : 0
  project = var.project_id
  role    = "roles/viewer"
  member  = "serviceAccount:${google_service_account.killer[0].email}"
}

# Role required for the Eventarc trigger to deliver events
resource "google_project_iam_member" "killer_eventarc" {
  count   = var.enable_kill_switch ? 1 : 0
  project = var.project_id
  role    = "roles/eventarc.eventReceiver"
  member  = "serviceAccount:${google_service_account.killer[0].email}"
}

# Cloud Functions Gen2 is built on Cloud Run; the trigger needs to invoke it
resource "google_project_iam_member" "killer_run_invoker" {
  count   = var.enable_kill_switch ? 1 : 0
  project = var.project_id
  role    = "roles/run.invoker"
  member  = "serviceAccount:${google_service_account.killer[0].email}"
}

# --------------- Pack function source + upload to GCS ---------------

data "archive_file" "killer_src" {
  count       = var.enable_kill_switch ? 1 : 0
  type        = "zip"
  source_dir  = "${path.module}/function"
  output_path = "${path.module}/.build/billing-killer.zip"
}

resource "google_storage_bucket" "fn_source" {
  count                       = var.enable_kill_switch ? 1 : 0
  project                     = var.project_id
  name                        = "${var.project_id}-fn-source"
  location                    = var.region
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
  force_destroy               = true
  labels                      = var.labels

  lifecycle_rule {
    condition {
      age                = 30
      with_state         = "ANY"
      num_newer_versions = 5
    }
    action { type = "Delete" }
  }
}

resource "google_storage_bucket_object" "killer_src" {
  count  = var.enable_kill_switch ? 1 : 0
  name   = "billing-killer-${data.archive_file.killer_src[0].output_md5}.zip"
  bucket = google_storage_bucket.fn_source[0].name
  source = data.archive_file.killer_src[0].output_path
}

# --------------- Cloud Function Gen2 ---------------

resource "google_cloudfunctions2_function" "killer" {
  count    = var.enable_kill_switch ? 1 : 0
  project  = var.project_id
  location = var.region
  name     = "billing-killer"

  build_config {
    runtime     = "python311"
    entry_point = "kill_billing"
    source {
      storage_source {
        bucket = google_storage_bucket.fn_source[0].name
        object = google_storage_bucket_object.killer_src[0].name
      }
    }
  }

  service_config {
    available_memory      = "256M"
    timeout_seconds       = 60
    max_instance_count    = 1
    service_account_email = google_service_account.killer[0].email
    environment_variables = {
      GCP_PROJECT_ID = var.project_id
    }
    ingress_settings = "ALLOW_INTERNAL_ONLY"
  }

  event_trigger {
    trigger_region = var.region
    event_type     = "google.cloud.pubsub.topic.v1.messagePublished"
    pubsub_topic   = google_pubsub_topic.budget.id
    retry_policy   = "RETRY_POLICY_RETRY"
  }

  labels = var.labels

  depends_on = [
    google_billing_account_iam_member.killer_billing_user,
  ]
}
