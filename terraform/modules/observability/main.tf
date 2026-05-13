# ──────────────────────────────────────────────────────────────────────────
# observability: Sentry project + Secret Manager secret
#
# 流程：
#   1. Terraform 建 Sentry project，輸出 DSN
#   2. 把 DSN 寫入 Secret Manager
#   3. Cloud Run 透過 secret_key_ref 注入成 env var SENTRY_DSN
# ──────────────────────────────────────────────────────────────────────────

data "sentry_organization" "this" {
  slug = var.sentry_organization
}

# 用既有的預設 team（建 Sentry org 時自動建好同名 team）。
# 如果想由 Terraform 全管，需要 token 有 team:admin 權限刪掉預設 team 後改回 resource。
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

# ─────────── 取每個 project 的預設 client key (DSN) ───────────
# 新版 sentry provider 移除 sentry_project.dsn_public，改用 sentry_key data source。

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

# ─────────── 把 DSN 存到 Secret Manager ───────────

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
