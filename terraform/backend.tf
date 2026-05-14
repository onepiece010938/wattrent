# ──────────────────────────────────────────────────────────────────────────
# State backend: HCP Terraform Cloud
#
# Why HCP Terraform Cloud:
#   1. Free tier: 5 users / 500 resources / unlimited workspaces.
#   2. Built-in state locking; no need to manage a GCS bucket + IAM yourself.
#   3. Plan / apply history is browsable in the UI, which makes review easy.
#   4. Integrates with GitHub Actions: read outputs via `tfe_outputs`, no SSM required.
#
# Alternative (pure GCP): comment the cloud{} block below and switch to
# backend "gcs" — but you must create the state bucket manually first
# (terraform cannot manage its own state bucket; chicken-and-egg).
# ──────────────────────────────────────────────────────────────────────────

terraform {
  cloud {
    organization = "wattrent" # Create an org with the same name on https://app.terraform.io

    workspaces {
      # Key:value tags (Terraform CLI 1.10+).
      # Both workspaces (wattrent-staging / wattrent-production) carry the
      # `app:wattrent` tag, so the selector below matches either one. Which
      # workspace is actually used depends on the TF_WORKSPACE env var:
      #   TF_WORKSPACE=wattrent-staging    terraform plan
      #   TF_WORKSPACE=wattrent-production terraform plan
      tags = {
        app = "wattrent"
      }
    }
  }

  # ──────── Alternative: plain GCS backend (comment the cloud{} above and enable below) ────────
  # backend "gcs" {
  #   bucket = "wattrent-tfstate"
  #   prefix = "terraform/state"
  # }
}
