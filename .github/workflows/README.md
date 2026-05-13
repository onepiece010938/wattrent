# GitHub Actions Workflows

| Workflow | 觸發 | 用途 |
| --- | --- | --- |
| [`ci.yml`](./ci.yml) | PR / push to main | 後端 `gofmt` / `go vet` / `go test`；前端 `expo lint` / `tsc` |
| [`backend-deploy.yml`](./backend-deploy.yml) | push to main 改 `backend/`；手動 | Build → push image → deploy Cloud Run |
| [`frontend-update.yml`](./frontend-update.yml) | push to main 改 `frontend/`；手動 | EAS Update（OTA） |
| [`frontend-build.yml`](./frontend-build.yml) | 手動 | EAS Build（出 IPA / AAB） |
| [`infra.yml`](./infra.yml) | PR / push 改 `terraform/`；手動 | Terraform plan（PR）／apply（main） |
| [`firestore-deploy.yml`](./firestore-deploy.yml) | push to main 改 `firestore/`；手動 | 部署 Firestore rules + indexes |
| [`security.yml`](./security.yml) | PR / push / 每週一 | Gitleaks、Dependency Review、govulncheck、npm audit |

## 必要的 Repository Variables（vars）

Settings → Secrets and variables → Actions → **Variables**

| Scope | Name | 範例 |
| --- | --- | --- |
| Environment `staging` | `GCP_PROJECT_ID` | `wattrent-staging` |
| Environment `production` | `GCP_PROJECT_ID` | `wattrent-prod` |

## 必要的 Repository Secrets

Settings → Secrets and variables → Actions → **Secrets**

| Scope | Name | 內容 | 來源 |
| --- | --- | --- | --- |
| Repository | `GCP_WORKLOAD_IDENTITY_PROVIDER` | `projects/{number}/locations/global/workloadIdentityPools/github-pool/providers/github-provider` | `terraform output github_actions_workload_identity_provider` |
| Repository | `GCP_DEPLOY_SA_EMAIL` | `github-actions@wattrent-{env}.iam.gserviceaccount.com` | `terraform output github_actions_service_account` |
| Repository | `TF_API_TOKEN` | HCP Terraform Cloud user token | <https://app.terraform.io/app/settings/tokens> |
| Repository | `EXPO_TOKEN` | EAS personal access token | <https://expo.dev/accounts/[account]/settings/access-tokens> |

> 不需要 `GOOGLE_CREDENTIALS`！全程靠 OIDC，沒有任何 long-lived GCP key 進 GitHub。

## Environments

建議建立兩個 Environments（Settings → Environments）：

- **`staging`** — 自動部署，無 reviewer
- **`production`** — 加 required reviewer（自己一人也加，當作雙重確認）

## ⚠️ Production 暫時鎖住

目前所有 deploy workflow（`infra.yml`、`backend-deploy.yml`、`firestore-deploy.yml`、
`frontend-update.yml`）的 `workflow_dispatch` 選項只剩 `staging`。
等 App 要送 Google Play / App Store 前夕再把 `production` 加回 `options` 陣列。
理由：避免手滑、省錢（少跑一份 Cloud Run 與 Firestore）、也避免 IAM/secret 在 prod 漂移。
（Terraform state 仍保留 `wattrent-production` workspace，隨時能解鎖。）

## 第一次跑 infra 之前

1. 已完成 `terraform/README.md` 的 bootstrap（建 GCP project、HCP TFC 設定）
2. 第一次 `terraform apply` 必須在本機跑（GH Actions 還沒有 WIF SA 可用）
3. 拿到 `terraform output` 之後，把 WIF provider / SA email 貼進 GitHub Secrets
4. 之後 GH Actions 才能接手後續 apply
