# A module must declare every non-default provider it uses;
# otherwise terraform init guesses sentry as hashicorp/sentry (which does not exist).
terraform {
  required_version = ">= 1.10.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.10"
    }
    sentry = {
      source  = "jianyuan/sentry"
      version = "~> 0.13"
    }
  }
}
