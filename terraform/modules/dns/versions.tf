# Module 必須宣告它使用哪些「非預設」provider
# 否則 terraform init 會把 cloudflare 推測成 hashicorp/cloudflare（不存在）
terraform {
  required_version = ">= 1.9.0"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.40"
    }
  }
}
