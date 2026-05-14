# ----------------------------------------------------------------------
# observability: Sentry project + Secret Manager secret
#
# Flow:
#   1. Terraform creates the Sentry project and exports the DSN
#   2. Write the DSN into Secret Manager
#   3. Cloud Run injects it as the SENTRY_DSN env var via secret_key_ref
# ----------------------------------------------------------------------

data "sentry_organization" "this" {
  slug = var.sentry_organization
}

# Reuse the existing default team (Sentry auto-creates a team with the same name when the org is created).
# To manage it fully via Terraform you would need a token with team:admin to delete the default team and recreate it as a resource.
data "sentry_team" "wattrent" {
  organization = data.sentry_organization.this.slug
  slug         = "wattrent"
}

resource "sentry_project" "backend" {
  organization = data.sentry_organization.this.slug
  teams        = [data.sentry_team.wattrent.slug]
  name         = "wattrent-backend-${var.env}"
  slug         = "wattrent-backend-${var.env}"
  platform     = "go"
}

resource "sentry_project" "frontend" {
  organization = data.sentry_organization.this.slug
  teams        = [data.sentry_team.wattrent.slug]
  name         = "wattrent-frontend-${var.env}"
  slug         = "wattrent-frontend-${var.env}"
  platform     = "react-native"
}

# --------- Pull each project's default client key (DSN) ---------
# The newer sentry provider removes sentry_project.dsn_public; use the sentry_key data source instead.

data "sentry_key" "backend" {
  organization = data.sentry_organization.this.slug
  project      = sentry_project.backend.slug
  first        = true
}

data "sentry_key" "frontend" {
  organization = data.sentry_organization.this.slug
  project      = sentry_project.frontend.slug
  first        = true
}

# --------- Store the DSN in Secret Manager ---------

resource "google_secret_manager_secret" "sentry_dsn_backend" {
  project   = var.project_id
  secret_id = "sentry-dsn-backend"

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "sentry_dsn_backend" {
  secret      = google_secret_manager_secret.sentry_dsn_backend.id
  secret_data = data.sentry_key.backend.dsn.public
}

resource "google_secret_manager_secret" "sentry_dsn_frontend" {
  project   = var.project_id
  secret_id = "sentry-dsn-frontend"

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "sentry_dsn_frontend" {
  secret      = google_secret_manager_secret.sentry_dsn_frontend.id
  secret_data = data.sentry_key.frontend.dsn.public
}
