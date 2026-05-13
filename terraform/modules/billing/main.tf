# ──────────────────────────────────────────────────────────────────────────
# billing: 預算上限 + 自動停機（kill switch）
#
# 為什麼需要：
#   GCP 沒有「達到預算就停服務」的開關，只有 alert email。
#   官方建議的做法：
#     1. 設 budget → 達到 threshold 時送訊息到 Pub/Sub
#     2. Cloud Function 訂閱 Pub/Sub，呼叫 Cloud Billing API
#        unset project 的 billing account
#     3. billing 一停 → Cloud Run / Firestore 寫入 / Vertex AI 立刻拒絕
#
# 副作用（你必須知道）：
#   - 停 billing 後，Cloud Run 5 分鐘內開始 503，Firestore 進入 read-only-cache
#   - 重新接帳單後，服務會回來，資料不會丟（除了 Vertex AI 的 in-flight request）
#   - 這是「硬性上限」，比起 alert-only 安全很多
#
# 參考：https://cloud.google.com/billing/docs/how-to/disable-billing-with-notifications
# ──────────────────────────────────────────────────────────────────────────

# ─────────────── Pub/Sub topic（budget alert 出口） ───────────────

resource "google_pubsub_topic" "budget" {
  project = var.project_id
  name    = "billing-budget-alerts"
  labels  = var.labels
}

# ─────────────── Budget 本體 ───────────────

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

  # 多階段 threshold：50/90% 純通知，100% 觸發 kill function
  dynamic "threshold_rules" {
    for_each = var.alert_thresholds
    content {
      threshold_percent = threshold_rules.value
      spend_basis       = "CURRENT_SPEND"
    }
  }

  # 額外加一個 100% threshold（kill switch 用）
  threshold_rules {
    threshold_percent = 1.0
    spend_basis       = "CURRENT_SPEND"
  }

  # 預測（forecast）也加一個 100%，提早一兩天通知
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

# ─────────────── Kill function 用的 service account ───────────────

resource "google_service_account" "killer" {
  count        = var.enable_kill_switch ? 1 : 0
  project      = var.project_id
  account_id   = "billing-killer"
  display_name = "Budget kill-switch function"
  description  = "Disables project billing when monthly budget exceeded"
}

# Function SA 要能解除 project 與 billing account 的關聯，需要在 billing account
# 層級拿到 billing.resourceAssociations.delete 權限。
# 這個權限只在 roles/billing.admin 裡（roles/billing.user 只能 link、不能 unlink）。
# 警告：roles/billing.admin 是幾乎的 billing account full control，規模變大後可
# 考慮改成 self-hosted custom role 縮減權限。
resource "google_billing_account_iam_member" "killer_billing_user" {
  count              = var.enable_kill_switch ? 1 : 0
  billing_account_id = var.billing_account
  role               = "roles/billing.admin"
  member             = "serviceAccount:${google_service_account.killer[0].email}"
}

# 允許 Function SA 讀 project（避免 NotFound）
resource "google_project_iam_member" "killer_viewer" {
  count   = var.enable_kill_switch ? 1 : 0
  project = var.project_id
  role    = "roles/viewer"
  member  = "serviceAccount:${google_service_account.killer[0].email}"
}

# Eventarc trigger 投遞事件需要的角色
resource "google_project_iam_member" "killer_eventarc" {
  count   = var.enable_kill_switch ? 1 : 0
  project = var.project_id
  role    = "roles/eventarc.eventReceiver"
  member  = "serviceAccount:${google_service_account.killer[0].email}"
}

# Function Gen2 底層是 Cloud Run，trigger 要呼叫它
resource "google_project_iam_member" "killer_run_invoker" {
  count   = var.enable_kill_switch ? 1 : 0
  project = var.project_id
  role    = "roles/run.invoker"
  member  = "serviceAccount:${google_service_account.killer[0].email}"
}

# ─────────────── Function source 打包 + 上傳 GCS ───────────────

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

# ─────────────── Cloud Function Gen2 ───────────────

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
