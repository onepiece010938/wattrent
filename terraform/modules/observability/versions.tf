# Module 必須宣告它使用哪些「非預設」provider
# 否則 terraform init 會把 sentry 推測成 hashicorp/sentry（不存在）
terraform {
  required_version = ">= 1.9.0"

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
