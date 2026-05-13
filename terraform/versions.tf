# ──────────────────────────────────────────────────────────────────────────
# Terraform & Provider 版本鎖定
#
# Terraform 版本：1.9+（支援 import block、check block）
# OpenTofu 1.7+ 也可使用（語法相容）
# ──────────────────────────────────────────────────────────────────────────

terraform {
  required_version = ">= 1.9.0"

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
