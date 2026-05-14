# ----------------------------------------------------------------------
# auth: Identity Platform
#
# Identity Platform is the GCP-flavored Firebase Auth, with a more explicit
# SLA and built-in multi-tenancy.
# 50k MAU is free; beyond that it is $0.0055 / MAU.
#
# OAuth providers (Google / Apple / Facebook) must be enabled in the console
# UI by pasting client_id / client_secret; Terraform does not manage them yet.
# ----------------------------------------------------------------------

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
