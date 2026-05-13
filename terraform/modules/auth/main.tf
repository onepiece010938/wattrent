# ──────────────────────────────────────────────────────────────────────────
# auth: Identity Platform
#
# Identity Platform = GCP 版的 Firebase Auth，但 SLA 更明確、有 multi-tenancy。
# 50k MAU 免費；超過 $0.0055 / MAU。
#
# OAuth provider（Google / Apple / Facebook）需在 console UI 開啟
# 並貼 client_id / client_secret，Terraform 暫不管理。
# ──────────────────────────────────────────────────────────────────────────

resource "google_identity_platform_config" "default" {
  project = var.project_id

  autodelete_anonymous_users = true

  sign_in {
    allow_duplicate_emails = false

    email {
      enabled           = true
      password_required = true
    }

    anonymous {
      enabled = false
    }
  }

  authorized_domains = var.authorized_domains
}
