# ──────────────────────────────────────────────────────────────────────────
# Terraform & Provider 版本鎖定
#
# Terraform 版本：1.10+（支援 cloud{} workspaces 的 key:value tags；
#                       1.9+ 仍有 import block / check block。CI 用 1.15.x）
# OpenTofu 1.8+ 也可使用（key:value tags 在 OpenTofu 1.8 跟進）
# ─────────────────────────────────────────────────────────────────────────

terraform {
  required_version = ">= 1.10.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.10"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 6.10"
    }
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.40"
    }
    sentry = {
      source  = "jianyuan/sentry"
      version = "~> 0.13"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.4"
    }
  }
}
