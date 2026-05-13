---
applyTo: "terraform/**"
description: "WattRent IaC（Terraform + GCP + Cloudflare + Sentry）規範"
---

# Infra — Terraform 指南

> 此規則自動套用在 `terraform/**` 之下的所有檔案。

## 全貌

* Provider：`hashicorp/google`、`hashicorp/google-beta`、`cloudflare/cloudflare`、`jianyuan/sentry`、`hashicorp/random`
* Terraform 版本：`>= 1.9.0`（OpenTofu 1.7+ 也相容）
* State：HCP Terraform Cloud（org `wattrent`）
* 兩個 workspace：`wattrent-staging`、`wattrent-production`
* 環境檔：`envs/staging.tfvars`、`envs/production.tfvars`

完整 bootstrap 步驟見 [terraform/README.md](../../terraform/README.md)。

## 模組分工

| Module | 內容 |
| --- | --- |
| `project_services` | 啟用 GCP API（其他模組都依賴它） |
| `database` | Firestore Native database（每個 project 只能有一個） |
| `storage` | 電表照片 GCS bucket（single-region + lifecycle） |
| `auth` | Identity Platform 設定 |
| `api` | Cloud Run + runtime SA + Artifact Registry + IAM + domain mapping + Gemini API key Secret |
| `cicd` | GitHub Actions Workload Identity Federation |
| `dns` | Cloudflare DNS records |
| `observability` | Sentry projects + Secret Manager（DSN） |

## 環境 / Secret

* `var.ai_backend`：`gemini`（預設、AI Studio API key）或 `vertex`（Vertex AI）。
  * `gemini` 時 `api` module 會在 Secret Manager 建 `<service>-gemini-api-key` secret 容器；
    實際金鑰請手動跑：
    `gcloud secrets versions add wattrent-api-gemini-api-key --data-file=-` 並貼上 AI Studio key 內容。
* Cloud Run env中 `AI_BACKEND` / `GEMINI_MODEL` 是明文；`GEMINI_API_KEY` 走 secret_key_ref。

## 命名

* GCP project：`wattrent-staging` / `wattrent-prod`（locals 自動推）
* Region：`asia-east1`（彰化）
* GCS bucket：`wattrent-meters-{env}`（single-region `ASIA-EAST1`）
* Cloud Run service：`wattrent-api`
* Artifact Registry repo：`wattrent`
* Service account 後綴：`{service-name}-run` / `github-actions`

## 編寫慣例

* 所有 module 必有三個檔案：`main.tf`、`variables.tf`、`outputs.tf`。
* 變數必填 `description`、`type`；optional 必填 `default`。
* 命名一律 snake_case。
* 標籤（labels）共用：`{ app, env, managed-by }`，由 root `locals.common_labels` 注入。
* 跨 module 拿值用 `module.x.output_name`，**不要**直接 hard-code project ID。
* 用 `count` 做 optional module（例：`var.enable_sentry ? 1 : 0`）；不要用 `for_each` 做 0/1 toggle。

## 安全 & 防呆

* Cloud Run image tag 由 CI 推；Terraform 用 `lifecycle.ignore_changes = [template[0].containers[0].image]` 避免互踩。
* Firestore `delete_protection_state = "DELETE_PROTECTION_ENABLED"`，誤 destroy 不會刪資料。
* GCS bucket：`uniform_bucket_level_access` + `public_access_prevention=enforced`，並關閉 versioning。
* `disable_on_destroy = false`：移除模組不關 API（避免誤關別處用的服務）。
* IAM：每個 service account 給最小權限；Cloud Run runtime SA **不能** 拿 `roles/owner`。
* WIF attribute_condition 限定 repo（`assertion.repository == ...`），多一道防護。

## 不要做的事

* ❌ 在 console UI 改任何資源（會被下次 apply 蓋回）。
* ❌ 在 root `main.tf` 寫 inline resource；都包成 module。
* ❌ 把 GCP service account JSON key 進 git；認證一律 ADC + WIF。
* ❌ 在 `*.tfvars` 寫 secret；secret 用 HCP TFC 環境變數或 Secret Manager。
* ❌ 改 `(default)` Firestore database 的 `location_id`（一旦建立不可變）。
* ❌ 在 production 把 Cloud Run `ingress` 改 `INGRESS_TRAFFIC_INTERNAL_*` 而不接 LB（會打不到）。
* ❌ 跳過 `terraform plan` 直接 apply；CI 會強制走 plan。

## 常用指令

```powershell
cd terraform
terraform login                # 第一次：HCP TFC token
terraform init
terraform fmt -recursive
terraform validate

$env:TF_WORKSPACE = "wattrent-staging"
terraform plan  -var-file="envs/staging.tfvars"
terraform apply -var-file="envs/staging.tfvars"
```

## 部署

* CI：[.github/workflows/infra.yml](../workflows/infra.yml)
  * PR：自動 `terraform plan`，把 plan 貼到 PR comment
  * push to main：自動 `terraform apply`
  * 手動：`workflow_dispatch` 可選 env / action
* 認證：Workload Identity Federation（OIDC，無 long-lived key）

## 第一次 apply 雞生蛋問題

Terraform 不能管理「自己賴以運作的資源」，所以以下要先手動：

1. 建 GCP project + 開 billing
2. 在 HCP TFC 建 organization 與 workspace
3. 建一個 bootstrap service account（`roles/owner`）+ JSON key，貼進 HCP TFC 的 `GOOGLE_CREDENTIALS`
4. 第一次 apply（會建出 GH Actions WIF SA）
5. 把 `terraform output github_actions_*` 的值貼到 GitHub repo Secrets，之後 CI 接管
