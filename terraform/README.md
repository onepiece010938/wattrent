# WattRent Terraform / OpenTofu 結構

> 對應 [docs/系統分析與意見回饋.md](../docs/系統分析與意見回饋.md) 與 [docs/firestore-schema.md](../docs/firestore-schema.md)。
> 管理 GCP（Cloud Run、Firestore、GCS、Vertex AI 選配、Identity Platform、Budget kill-switch）+ Cloudflare DNS + Sentry + Gemini API key Secret。

---

## 設計原則

1. **零長效金鑰** — TFC 與 GitHub Actions 都用 OIDC + Workload Identity Federation，磁碟與 secret store 上完全不放 GCP service account JSON key。
2. **預算硬上限** — 達到預算 100% 自動 disable billing；Cloud Run 立刻 503，Firestore 變 read-only-cache，**保證不會被多收錢**。
3. **State on HCP TFC** — 兩個 workspace（`wattrent-staging` / `wattrent-production`）跑各自的 `tfvars`，state 不進 git。
4. **Module 化** — root 只做組合，所有資源包進 `modules/*`。
5. **不在 console 動手** — 除了下面寫明的「一次性 bootstrap」之外，所有變更都走 PR + plan + apply。

## 目錄

```
terraform/
├── README.md            ← 此檔
├── versions.tf          ← Terraform / Provider 版本
├── backend.tf           ← State backend（HCP Terraform Cloud）
├── providers.tf         ← Provider 設定（auth 走 ADC / TFC 動態 credentials）
├── variables.tf         ← 頂層輸入
├── locals.tf            ← 共用 locals（project ID、API 清單、labels）
├── main.tf              ← Module composition
├── outputs.tf           ← 給 GitHub Actions 與 frontend 拿
├── envs/
│   ├── staging.tfvars
│   └── production.tfvars
├── scripts/
│   ├── bootstrap.ps1    ← 一次性：建 TFC WIF、SA、IAM
│   └── set-tfc-vars.ps1 ← 一次性：把 TFC env/tf 變數一次寫齊（idempotent）
└── modules/
    ├── project_services/   ← 啟用 GCP API
    ├── api/                ← Cloud Run + Service Account + IAM + Artifact Registry
    ├── database/           ← Firestore database (Native mode)
    ├── storage/            ← GCS bucket（電表照片 + lifecycle）
    ├── auth/               ← Identity Platform 設定
    ├── cicd/               ← GitHub Actions Workload Identity Federation
    ├── dns/                ← Cloudflare records
    ├── observability/      ← Sentry project
    └── billing/            ← Budget + Pub/Sub + Kill-switch Cloud Function
```

---

## 一次性 bootstrap（每個環境跑一次）

> Terraform 不能管理「自己賴以運作的資源」（誰來建第一個 SA？）。
> 我們把這段做成 PowerShell 腳本，幫你把 TFC 的 WIF 設定好之後就再也不用碰。

### 0. 安裝工具

```powershell
# 已有可跳過
winget install Google.CloudSDK
winget install Hashicorp.Terraform
winget install Cloudflare.cloudflared    # 之後才會用到
```

> ⚠️ winget 三個套件**不會自動把 PATH 加到目前 PowerShell session**，要重開一個視窗（或 `refreshenv`）才能看到 `gcloud` / `terraform` / `cloudflared`。
>
> 若 `where.exe gcloud` 仍找不到，把以下三個目錄加進使用者 PATH（一次設好就永久生效）：
>
> ```text
> %LOCALAPPDATA%\Google\Cloud SDK\google-cloud-sdk\bin
> %LOCALAPPDATA%\Microsoft\WinGet\Packages\Hashicorp.Terraform_Microsoft.Winget.Source_8wekyb3d8bbwe
> %LOCALAPPDATA%\Microsoft\WinGet\Packages\Cloudflare.cloudflared_Microsoft.Winget.Source_8wekyb3d8bbwe
> ```

#### 安裝 `gcloud beta`（billing 指令需要）

winget 版的 gcloud 鎖住 component manager，直接 `gcloud components install beta` 會跳「Cannot use bundled Python ... in non-interactive mode」。
照官方提示繞過：

```powershell
$env:CLOUDSDK_PYTHON = (gcloud components copy-bundled-python | Select-Object -Last 1).Trim()
gcloud components install beta --quiet
Remove-Item Env:CLOUDSDK_PYTHON
gcloud beta --help        # 驗證
```

登入：

```powershell
gcloud auth login
gcloud auth application-default login    # 本地若要直接 terraform plan 也需要這個
```

### 1. 在 HCP Terraform Cloud 建好 organization + workspace

到 <https://app.terraform.io>：

1. 建 organization，名稱建議 `wattrent`
2. 建兩個 workspace：
   - `wattrent-staging`
   - `wattrent-production`

   **Workflow 選 `CLI-driven`**（不是 VCS-driven，也不是 API-driven）：
   - 我們的 GitHub Actions（[.github/workflows/infra.yml](../.github/workflows/infra.yml)）是用 `terraform plan/apply` CLI 觸發 TFC，從 TFC 角度等同 CLI workflow。
   - VCS-driven 會讓 TFC 自己訂閱 GitHub webhook，跟 GH Actions 重複觸發。
   - API-driven 是給寫客製 orchestrator 的人用的，我們不需要。

3. 兩個 workspace 都加 tag（純分類用，**不影響執行**）：
   * 舊版 UI 只有一格 → 填 `wattrent`
   * 新版 key/value UI → 加兩條：`app=wattrent`、`env=staging`（production workspace 填 `env=production`）
   * 不確定就直接 Skip，事後還能改
4. 進每個 workspace → **Settings → General → Execution Mode** → **保持 `Remote`**（預設）。
   * Remote：plan/apply 跑在 TFC 雲端 runner，可吃我們設定的 OIDC 動態 credentials。
   * Local：TFC 只當 state backend，dynamic credentials 失效（要退回 SA key），**不要選**。

### 2. 跑 bootstrap 腳本

```powershell
cd terraform\scripts

.\bootstrap.ps1 `
  -ProjectId        "wattrent-staging" `
  -BillingAccountId "0X0X0X-0X0X0X-0X0X0X" `
  -TfcOrganization  "wattrent" `
  -TfcWorkspace     "wattrent-staging"

# Production 環境
.\bootstrap.ps1 `
  -ProjectId        "wattrent-prod" `
  -BillingAccountId "0X0X0X-0X0X0X-0X0X0X" `
  -TfcOrganization  "wattrent" `
  -TfcWorkspace     "wattrent-production"
```

腳本做的事（全部 idempotent，可重複執行）：

| 步驟 | 內容 |
| --- | --- |
| 1 | `gcloud projects create` 建 GCP project（或跳過） |
| 2 | `gcloud beta billing projects link` 連 billing |
| 3 | 啟用 bootstrap 必要 API（`iam` / `iamcredentials` / `cloudresourcemanager` / `sts` / `serviceusage`） |
| 4 | 建 Workload Identity Pool `tfc-pool` |
| 5 | 建 Pool Provider `tfc-provider`，issuer = `https://app.terraform.io`，attribute_condition 限定 organization |
| 6 | 建 SA `tfc-runner@{project}.iam.gserviceaccount.com` |
| 7 | 給 SA `roles/owner`（project）+ `roles/billing.user` & `roles/billing.costsManager`（billing account） |
| 8 | 綁定：`principalSet://.../attribute.terraform_full_workspace/...workspace:{workspace}` → `workloadIdentityUser` 在該 SA |
| 9 | 印出要貼到 TFC workspace 的環境變數 |

### 3. 把變數塞進 TFC workspace（自動）

懶得在 TFC UI 一個一個加？用 [`set-tfc-vars.ps1`](./scripts/set-tfc-vars.ps1)，一次寫齊 5 個 env var + 2 個 Terraform var（`gcp_billing_account` 自動標 sensitive）。Idempotent，已存在會 PATCH 更新。

先 `terraform login` 一次（會把 token 寫到 `%APPDATA%\terraform.d\credentials.tfrc.json`），之後：

```powershell
cd terraform\scripts

# Staging
.\set-tfc-vars.ps1 `
  -Organization      "wattrent" `
  -Workspace         "wattrent-staging" `
  -GcpProjectId      "wattrent-staging" `
  -GcpProjectNumber  "<bootstrap 印出的 project number>" `
  -GcpBillingAccount "0X0X0X-0X0X0X-0X0X0X" `
  -GcpSaEmail        "tfc-runner@wattrent-staging.iam.gserviceaccount.com"

# Production
.\set-tfc-vars.ps1 `
  -Organization      "wattrent" `
  -Workspace         "wattrent-production" `
  -GcpProjectId      "wattrent-prod" `
  -GcpProjectNumber  "<bootstrap 印出的 project number>" `
  -GcpBillingAccount "0X0X0X-0X0X0X-0X0X0X" `
  -GcpSaEmail        "tfc-runner@wattrent-prod.iam.gserviceaccount.com"
```

如果偏好 UI，到 `https://app.terraform.io/app/{org}/workspaces/{workspace}/variables`，手動新增同樣的 7 個變數：

**Environment variables**（不是 Terraform variable）：

| Key | Value |
| --- | --- |
| `TFC_GCP_PROVIDER_AUTH` | `true` |
| `TFC_GCP_RUN_SERVICE_ACCOUNT_EMAIL` | （腳本印出的 SA email） |
| `TFC_GCP_PROJECT_NUMBER` | （腳本印出的 project number） |
| `TFC_GCP_WORKLOAD_POOL_ID` | `tfc-pool` |
| `TFC_GCP_WORKLOAD_PROVIDER_ID` | `tfc-provider` |

**Terraform variables**：

| Key | Value | Sensitive |
| --- | --- | --- |
| `gcp_project_id` | `wattrent-staging` / `wattrent-prod` | no |
| `gcp_billing_account` | `0X0X0X-0X0X0X-0X0X0X` | **yes** |

之後 TFC 跑每個 plan/apply 都會自動：
1. 從自己的 OIDC issuer 取 short-lived token
2. 拿去 GCP STS 換 federated token
3. impersonate `tfc-runner@` SA
4. 把 short-lived ADC 寫到 runner 容器 → google provider 自動讀

整個流程**沒有任何 long-lived key**離開 GCP。

### 4. 第三方 API token（Cloudflare / Sentry，用到再加）

同樣是 Environment variable，且勾 sensitive：

| Key | 用途 | 最小權限 |
| --- | --- | --- |
| `CLOUDFLARE_API_TOKEN` | DNS 模組 | Zone:Read + DNS:Edit on 該 zone |
| `SENTRY_AUTH_TOKEN` | Sentry 模組 | `project:write`、`project:read` |

### 5. 第一次 apply

```powershell
cd terraform
terraform login        # 第一次登入 HCP TFC（瀏覽器跳出）
terraform init

$env:TF_WORKSPACE = "wattrent-staging"
terraform plan  -var-file="envs/staging.tfvars"
terraform apply -var-file="envs/staging.tfvars"
```

第一次 apply 完成後，把 outputs 貼到 GitHub repo Secrets 給 GH Actions 用：

```powershell
terraform output -raw github_actions_workload_identity_provider
terraform output -raw github_actions_service_account
```

對應到 GitHub repo Settings → Secrets：
- `GCP_WORKLOAD_IDENTITY_PROVIDER_STAGING`
- `GCP_DEPLOY_SA_EMAIL_STAGING`

production 同樣再跑一次。

---

## 預算硬上限（kill switch）

### 為什麼要這個

GCP **沒有**「達到金額自動關服務」的內建開關，只有 alert email。
`billing` module 用官方建議的做法做出硬性上限：

```
每月 budget
   │ 達到 50% / 90% → email（通知，不停服）
   ▼
   100% 達標
   │
   ▼
google_billing_budget.all_updates_rule.pubsub_topic
   │
   ▼
Pub/Sub topic: billing-budget-alerts
   │
   ▼
Cloud Function (Gen2): billing-killer
   │
   │  呼叫 cloudbilling.projects.updateBillingInfo
   │  body = { billingAccountName: "" }
   ▼
Project billing → DISABLED
   │
   ▼
Cloud Run 503 / Firestore writes 失敗 / Gemini OCR 拒絕
（讀取自己的 metadata、Cloud Logging 仍可運作）
```

副作用必須知道：

* 一旦觸發，App 直接 down 到你手動恢復為止 → **這是設計目的**：不被超收。
* Firestore 在 billing 停用後**進入 read-only cache**，新寫入一律失敗。資料**不會掉**。
* 重新接 billing：`gcloud beta billing projects link {project} --billing-account=...`，5 分鐘內回復。
* Cloud Function 自己也是付費服務 — 但 billing 停用前最後一次執行已經把自己的工作做完。

### 設定方式

在 [envs/staging.tfvars](envs/staging.tfvars) / [envs/production.tfvars](envs/production.tfvars)：

```hcl
billing_budget_amount        = 5     # USD/月
billing_budget_currency      = "USD" # 必須等於 billing account 幣別
billing_alert_thresholds     = [0.5, 0.9]   # 純 email
billing_kill_switch_enabled  = true   # ← 這個是「拒絕流量」開關
```

* **想只要 alert 不要 kill** → `billing_kill_switch_enabled = false`，此時只送 email
* **想 50% 就拒絕流量** → `billing_alert_thresholds = []` 加 `billing_budget_amount = 你的50%金額`
* 預算幣別必須跟 billing account 一致；台灣信用卡開的 GCP 帳號通常是 USD，但有人是 TWD，到 <https://console.cloud.google.com/billing> 看一下

### 怎麼測試 kill switch

不想真的等到月底破預算，可以手動發一筆假訊息：

```powershell
gcloud pubsub topics publish billing-budget-alerts `
  --project=wattrent-staging `
  --message='{"costAmount":1000,"budgetAmount":1,"costIntervalStart":"2026-05-01T00:00:00Z"}'

# 看 Function log
gcloud functions logs read billing-killer `
  --region=asia-east1 --project=wattrent-staging --gen2
```

測完別忘了把 billing account 重新接回去：

```powershell
gcloud beta billing projects link wattrent-staging `
  --billing-account=XXXXXX-XXXXXX-XXXXXX
```

---

## 日常操作

```powershell
cd terraform
terraform login                # 第一次：登入 HCP TFC
terraform init

# 切換 workspace
$env:TF_WORKSPACE = "wattrent-staging"
terraform plan  -var-file="envs/staging.tfvars"
terraform apply -var-file="envs/staging.tfvars"

$env:TF_WORKSPACE = "wattrent-production"
terraform plan  -var-file="envs/production.tfvars"
terraform apply -var-file="envs/production.tfvars"
```

CI/CD 走 [.github/workflows/infra.yml](../.github/workflows/infra.yml)：PR 自動 plan、main 自動 apply。

---

## 與其他工具的分工

| 任務 | 由誰處理 |
| --- | --- |
| GCP 資源（Cloud Run、Firestore、GCS、IAM、Budget 等） | Terraform |
| Firestore rules / indexes 部署 | `firebase deploy --only firestore:rules,firestore:indexes`（GitHub Actions 跑） |
| Cloud Run image build & push | GitHub Actions（用 WIF 認證） |
| Cloud Run deploy（image tag 更新） | GitHub Actions（`gcloud run deploy --image=...`） |
| 機密內容 | Secret Manager（Terraform 建 secret，CI/CD 寫值） |
| 前端 OTA | EAS Update（GitHub Actions） |

---

## TODO（按優先級排序）

### P0：上線前必處理

- [ ] **Bootstrap 跑兩次**
  完成兩個環境的 `bootstrap.ps1` + 在 TFC workspace 設好 5 個 `TFC_GCP_*` 變數。沒這步，TFC 會直接 auth fail。

- [ ] **填 `gcp_billing_account`**
  兩個 `envs/*.tfvars` 預設是 placeholder `XXXXXX-XXXXXX-XXXXXX`，跑 plan 會被 `validation` 擋下。到 <https://console.cloud.google.com/billing> 拿。

- [ ] **驗證 kill switch 真的會停**
  跑上面「怎麼測試 kill switch」的指令，確認看到 `BILLING DISABLED on projects/...` log，然後重新接回 billing。**沒驗證過的 kill switch 等於沒裝**。

- [ ] **填 `github_repository` 並第一次 apply**
  `envs/*.tfvars` 的 `github_repository = ""` 會導致 cicd module 不綁 WIF principal → GitHub Actions 連不上 GCP。填好之後再 apply。

### P1：上線一個月內處理

- [ ] **網域驗證 & DNS apply**
  - 到 GCP Cloud Run console → Manage Custom Domains → 加 `api.wattrent.app` → 拿到 TXT 紀錄
  - 把 TXT 加到 Cloudflare DNS（手動，**這步 GCP API 沒開放給 Terraform**）
  - 驗證通過後在 `production.tfvars` 填 `cloudflare_zone_id` + `domain_root`，再 apply
  - 完成後 `dns` module 才會建 CNAME

- [ ] **OAuth provider（Google / Apple sign-in）**
  - Identity Platform 的 OAuth IdP 沒辦法 100% 用 Terraform 設好（OAuth client secret 必須先在 Google Cloud Console 建立）
  - 流程：APIs & Services → Credentials → Create OAuth client ID → 拿 Client ID + Secret → 填進 `auth` module 的新變數（待加）
  - 真的要走全自動可以用 `google_identity_platform_oauth_idp_config`，但 client secret 還是要先準備好
  - 暫時：在 Identity Platform UI 啟用，之後 `terraform import` 進來

- [ ] **Cloud Monitoring notification channel**
  目前 budget alert 只送到 billing account 的預設 email（第一次設 billing 時填的）。
  要送到 LINE Notify / Slack：
  1. Cloud Monitoring → Notification Channels → 建 webhook
  2. 把 channel ID 加到 `billing_notification_channels = ["projects/{p}/notificationChannels/{id}"]`
  3. apply

- [ ] **PR preview 環境**
  目前 `cicd` module 的 WIF principalSet 是「該 repo 任意 branch / PR 都能 impersonate deploy SA」（夠用）。
  若要做「每個 PR 一個獨立 Cloud Run revision」：
  - 在 [.github/workflows/](../.github/workflows/) 加新 workflow，monitor PR event
  - `gcloud run deploy wattrent-api-pr-{number} --no-traffic --tag=pr-{number}`
  - PR close 時 `gcloud run services delete wattrent-api-pr-{number}`
  - 不需要動 Terraform；Cloud Run revision 是動態的

### P2：日後優化

- [ ] **最小權限 SA**
  `tfc-runner` 現在拿 `roles/owner`。要拆細：
  - `roles/run.admin`、`roles/firestore.admin`、`roles/storage.admin`、`roles/iam.serviceAccountAdmin`、`roles/resourcemanager.projectIamAdmin`、`roles/cloudfunctions.admin`、`roles/billing.user`
  - 之後缺什麼補什麼（會看到 `403 Permission denied` log）

- [ ] **Multi-region failover**
  目前所有東西都在 `asia-east1`（彰化）。Firestore Native 不支援跨 region failover；要做 DR 必須改 `nam5`/`eur3` multi-region database（一旦選定不能改）。
  Cloud Run 改 multi-region：用 Global External LB + 兩個 region 的 service。

- [ ] **Cost anomaly detection**
  `google_billing_budget` 是「絕對金額」，不會發現「同一週期內忽然花得比平常多 10 倍」。
  Cloud Monitoring 有 anomaly detection alert policy，可以加。

- [ ] **Terraform import 既有資源**
  若手動在 console 建過東西，跑 `terraform import` 收進來，避免下次 apply 衝突。

- [ ] **`gcloud beta` → `gcloud`**
  `bootstrap.ps1` 用了 `gcloud beta billing`；之後 GA 之後改回主命令。

---

## 疑難排解

| 症狀 | 可能原因 |
| --- | --- |
| `Error: Failed to retrieve credentials` (TFC plan) | TFC workspace 沒設 `TFC_GCP_*` 環境變數，或 bootstrap 沒綁定 WIF principal |
| `Error: googleapi: Error 403: Permission ...` | `tfc-runner` SA 缺權限。最快：`roles/owner`；正確：找出對應 role 補上 |
| `Error: Resource ... already exists` (第一次 apply) | 該資源在 console 手動建過。`terraform import` 收進來 |
| `Cloud Run service 503 突然全掛` | **可能是 kill switch 觸發了！** 看 Cloud Logging → `resource.type="cloud_run_revision"` 與 billing-killer function log |
| `Identity Platform: PROJECT_NOT_FOUND` | `auth` module 在 `google_identity_platform_config` 失敗，需先在 console 啟用一次 Identity Platform（$0） |
| `Error: required field is not set` (provider) | `gcp_billing_account` 沒填，或 `validation` regex 不對 |

---

## 參考資料

- [HCP TFC Dynamic Credentials with GCP](https://developer.hashicorp.com/terraform/cloud-docs/workspaces/dynamic-provider-credentials/gcp-configuration)
- [Cap project costs by automatically disabling Cloud Billing](https://cloud.google.com/billing/docs/how-to/disable-billing-with-notifications)
- [Cloud Run with Workload Identity Federation from GitHub Actions](https://github.com/google-github-actions/auth#workload-identity-federation-via-a-service-account)
- [Identity Platform vs Firebase Auth](https://cloud.google.com/identity-platform/docs/product-comparison)
