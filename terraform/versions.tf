# ──────────────────────────────────────────────────────────────────────────
# Terraform & provider version pinning
#
# Terraform: 1.10+ (needed for key:value tags in cloud{} workspaces;
#                   1.9+ already had import/check blocks. CI uses 1.15.x)
# OpenTofu 1.8+ also works (key:value tags landed in OpenTofu 1.8).
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
