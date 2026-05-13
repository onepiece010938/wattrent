# ──────────────────────────────────────────────────────────────────────────
# State Backend：HCP Terraform Cloud
#
# 為何選 HCP Terraform Cloud：
#   1. 免費方案：5 user / 500 resources / unlimited workspaces
#   2. 內建 state lock，免去自己管 GCS bucket + IAM
#   3. UI 上看 plan / apply 歷史，方便 review
#   4. 與 GitHub Actions 整合：用 `tfe_outputs` 拿輸出值，無需 SSM
#
# 替代方案（若要全 GCP）：把下面註解掉，改用 backend "gcs"，並先手動建立
# state bucket（terraform 不能管理自己的 state bucket，會有 chicken-and-egg）。
# ──────────────────────────────────────────────────────────────────────────

terraform {
  cloud {
    organization = "wattrent" # 在 https://app.terraform.io 建立同名 org

    workspaces {
      # Key:value tags（Terraform CLI 1.10+ 才支援）
      # 兩個 workspace（wattrent-staging / wattrent-production）都有 `app:wattrent` 標籤，
      # 下面這個選擇器會同時 match 到。具體看哪一個靠 TF_WORKSPACE env var：
      #   TF_WORKSPACE=wattrent-staging    terraform plan
      #   TF_WORKSPACE=wattrent-production terraform plan
      tags = {
        app = "wattrent"
      }
    }
  }

  # ──────── 替代：純 GCS backend（取消上面 cloud{} 並啟用下面） ────────
  # backend "gcs" {
  #   bucket = "wattrent-tfstate"
  #   prefix = "terraform/state"
  # }
}
