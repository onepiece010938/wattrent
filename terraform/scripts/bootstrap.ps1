# ──────────────────────────────────────────────────────────────────────────
# WattRent Terraform Bootstrap（一次性）
#
# 目的：在「完全不產生長效 service account key」的前提下，
#       建出 HCP Terraform Cloud 用來 impersonate 的 Workload Identity 設定。
#
# 跑完之後，TFC workspace 就能用 OIDC 動態 credentials 去管 GCP，
# 你個人電腦上、TFC 上、GitHub 上都不會再有 long-lived 的 GCP key。
#
# 先決條件：
#   1. 已安裝 gcloud CLI、firebase CLI、terraform CLI
#   2. 已用 `gcloud auth login` 登入有 billing 管理權的帳號
#   3. 在 https://app.terraform.io 建好 organization 與兩個 workspace：
#        - {org}/wattrent-staging
#        - {org}/wattrent-production
#      （Workflow 選 CLI-driven 即可）
#
# 用法：
#   .\bootstrap.ps1 `
#     -ProjectId        "wattrent-staging" `
#     -BillingAccountId "0X0X0X-0X0X0X-0X0X0X" `
#     -TfcOrganization  "wattrent" `
#     -TfcWorkspace     "wattrent-staging"
#
# 兩個環境（staging / production）各跑一次。
# ──────────────────────────────────────────────────────────────────────────

[CmdletBinding()]
Param(
  [Parameter(Mandatory = $true)]  [string] $ProjectId,
  [Parameter(Mandatory = $true)]  [string] $BillingAccountId,
  [Parameter(Mandatory = $true)]  [string] $TfcOrganization,
  [Parameter(Mandatory = $true)]  [string] $TfcWorkspace,
  [Parameter(Mandatory = $false)] [string] $ProjectName = "WattRent",
  [Parameter(Mandatory = $false)] [string] $PoolId      = "tfc-pool",
  [Parameter(Mandatory = $false)] [string] $ProviderId  = "tfc-provider",
  [Parameter(Mandatory = $false)] [string] $TfcSaName   = "tfc-runner"
)

$ErrorActionPreference = "Stop"

function Step($msg) { Write-Host "==> $msg" -ForegroundColor Cyan }
function Info($msg) { Write-Host "    $msg" -ForegroundColor DarkGray }
function Done($msg) { Write-Host "    $msg" -ForegroundColor Green }
function Warn($msg) { Write-Host "    $msg" -ForegroundColor Yellow }

# 執行 gcloud 並检查 exit code。失敗就丟出帶標記的 exception，
# 避免腳本在 project 不存在的狀態下繼續跑。
# 注意：暫時把 ErrorActionPreference 降為 Continue，因為 gcloud 會把進度訊息
# 寫到 stderr（例如 "Create in progress for..."），在 Stop 模式會誤判為失敗。
function Invoke-Gcloud {
  Param([Parameter(Mandatory=$true)][string]$Description, [Parameter(ValueFromRemainingArguments=$true)][string[]]$Args)
  $previousEAP = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $output = & gcloud @Args 2>&1
    if ($LASTEXITCODE -ne 0) {
      Write-Host ($output | Out-String) -ForegroundColor Red
      throw "gcloud failed [$Description] (exit $LASTEXITCODE)"
    }
    return $output
  } finally {
    $ErrorActionPreference = $previousEAP
  }
}

# 「存在性檢查」專用：跑 gcloud describe / list，回傳 $true / $false，不丟 exception。
# 避免 native command stderr 在 EAP=Stop 下被當 terminating error。
function Test-GcloudExists {
  Param([Parameter(ValueFromRemainingArguments=$true)][string[]]$Args)
  $previousEAP = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $null = & gcloud @Args 2>&1 | Out-Null
    return ($LASTEXITCODE -eq 0)
  } finally {
    $ErrorActionPreference = $previousEAP
  }
}

# ───────────────────────────────────────────────────────────
# 0. 前置檢查
# ───────────────────────────────────────────────────────────
Step "檢查 gcloud 登入"
$account = (gcloud config get-value account 2>$null).Trim()
if (-not $account) { throw "請先執行 gcloud auth login" }
Info "登入帳號：$account"

# ───────────────────────────────────────────────────────────
# 1. 建立 / 確認 GCP project
# ───────────────────────────────────────────────────────────
Step "確認 GCP project：$ProjectId"
if (-not (Test-GcloudExists projects describe $ProjectId --format="value(projectId)")) {
  Info "建立 project..."
  # display name 不能含 ()，只能 letters/digits/spaces/hyphens/single quotes
  $displayName = "$ProjectName $ProjectId"
  Invoke-Gcloud "projects create" projects create $ProjectId --name=$displayName --quiet | Out-Null
  Done "已建立 $ProjectId"
} else {
  Done "已存在，跳過建立"
}

# ───────────────────────────────────────────────────────────
# 2. 連結 billing account
# ───────────────────────────────────────────────────────────
Step "連結 billing account：$BillingAccountId"
Invoke-Gcloud "billing link" beta billing projects link $ProjectId --billing-account=$BillingAccountId --quiet | Out-Null
Done "已連結"

# ───────────────────────────────────────────────────────────
# 3. 啟用 bootstrap 必須的 API
#    （其他 API 之後由 Terraform project_services 模組處理）
# ───────────────────────────────────────────────────────────
Step "啟用 bootstrap 階段必要的 API"
$bootstrapApis = @(
  "iam.googleapis.com",
  "iamcredentials.googleapis.com",
  "cloudresourcemanager.googleapis.com",
  "sts.googleapis.com",
  "serviceusage.googleapis.com"
)
foreach ($api in $bootstrapApis) {
  Info "  enable $api"
  Invoke-Gcloud "services enable $api" services enable $api --project=$ProjectId --quiet | Out-Null
}
Done "OK"

# ───────────────────────────────────────────────────────────
# 4. 建立 Workload Identity Pool（給 TFC）
# ───────────────────────────────────────────────────────────
Step "建立 Workload Identity Pool：$PoolId"
$poolExists = Test-GcloudExists iam workload-identity-pools describe $PoolId `
  --project=$ProjectId --location="global" --format="value(name)"
if (-not $poolExists) {
  Invoke-Gcloud "WIF pool create" iam workload-identity-pools create $PoolId `
    --project=$ProjectId `
    --location="global" `
    --display-name="HCP Terraform Cloud" `
    --description="OIDC pool for HCP Terraform Cloud dynamic credentials" `
    --quiet | Out-Null
  Done "已建立"
} else {
  Done "已存在，跳過"
}

# ───────────────────────────────────────────────────────────
# 5. 建立 Workload Identity Pool Provider（信任 TFC OIDC issuer）
#    attribute_condition 限制只接受指定 organization 的 token
# ───────────────────────────────────────────────────────────
Step "建立 Workload Identity Pool Provider：$ProviderId"
$providerExists = Test-GcloudExists iam workload-identity-pools providers describe $ProviderId `
  --project=$ProjectId --location="global" --workload-identity-pool=$PoolId `
  --format="value(name)"

$attrMapping = "google.subject=assertion.sub," + `
               "attribute.aud=assertion.aud," + `
               "attribute.terraform_organization_id=assertion.terraform_organization_id," + `
               "attribute.terraform_organization_name=assertion.terraform_organization_name," + `
               "attribute.terraform_workspace_id=assertion.terraform_workspace_id," + `
               "attribute.terraform_workspace_name=assertion.terraform_workspace_name," + `
               "attribute.terraform_full_workspace=assertion.terraform_full_workspace," + `
               "attribute.terraform_run_phase=assertion.terraform_run_phase"

$attrCondition = "assertion.terraform_organization_name == '$TfcOrganization'"

# WIF audience：GCP 慣例是 //iam.googleapis.com/<provider_full_name>。
# TFC 預設就送這個，所以這裡 allowed-audiences 必須一致（不能寫 https://...）。
$projectNumberForAud = (Invoke-Gcloud "describe project number for aud" projects describe $ProjectId --format="value(projectNumber)").Trim()
$allowedAudience = "//iam.googleapis.com/projects/$projectNumberForAud/locations/global/workloadIdentityPools/$PoolId/providers/$ProviderId"

if (-not $providerExists) {
  Invoke-Gcloud "WIF provider create" iam workload-identity-pools providers create-oidc $ProviderId `
    --project=$ProjectId `
    --location="global" `
    --workload-identity-pool=$PoolId `
    --display-name="HCP TFC OIDC" `
    --issuer-uri="https://app.terraform.io" `
    --allowed-audiences=$allowedAudience `
    --attribute-mapping=$attrMapping `
    --attribute-condition=$attrCondition `
    --quiet | Out-Null
  Done "已建立"
} else {
  Step "更新既有 WIF provider 的 allowed-audiences（若已正確會 no-op）"
  Invoke-Gcloud "WIF provider update audience" iam workload-identity-pools providers update-oidc $ProviderId `
    --project=$ProjectId `
    --location="global" `
    --workload-identity-pool=$PoolId `
    --allowed-audiences=$allowedAudience `
    --quiet | Out-Null
  Done "已更新"
}

# ───────────────────────────────────────────────────────────
# 6. 建立 TFC runner service account
# ───────────────────────────────────────────────────────────
$tfcSaEmail = "$TfcSaName@$ProjectId.iam.gserviceaccount.com"
Step "建立 TFC runner SA：$tfcSaEmail"

$saExists = Test-GcloudExists iam service-accounts describe $tfcSaEmail `
  --project=$ProjectId --format="value(email)"
if (-not $saExists) {
  Invoke-Gcloud "sa create" iam service-accounts create $TfcSaName `
    --project=$ProjectId `
    --display-name="HCP Terraform Cloud runner" `
    --description="TFC impersonates this SA via WIF; no key issued" `
    --quiet | Out-Null
  Done "已建立"
  Info "等待 SA 在 IAM 全域 propagate（避免後面 binding NotFound）..."
  Start-Sleep -Seconds 30
} else {
  Done "已存在，跳過"
}

# ───────────────────────────────────────────────────────────
# 7. 給 TFC SA 必要權限
#    note: roles/owner 在 GCP 是「project 全權」。Terraform 要建 IAM、
#          enable API、改 Cloud Run 設定...，最簡單一次給 owner。
#          若想最小權限可改成 Editor + 個別 admin role 組合。
# ───────────────────────────────────────────────────────────
Step "授權 TFC SA：roles/owner on $ProjectId"
Invoke-Gcloud "add owner binding" projects add-iam-policy-binding $ProjectId `
  --member="serviceAccount:$tfcSaEmail" `
  --role="roles/owner" `
  --condition=None `
  --quiet | Out-Null
Done "OK"

Step "授權 TFC SA：roles/billing.user on $BillingAccountId（讓 budget 模組可建預算）"
Invoke-Gcloud "add billing.user binding" beta billing accounts add-iam-policy-binding $BillingAccountId `
  --member="serviceAccount:$tfcSaEmail" `
  --role="roles/billing.user" `
  --quiet | Out-Null

Step "授權 TFC SA：roles/billing.costsManager on $BillingAccountId"
Invoke-Gcloud "add billing.costsManager binding" beta billing accounts add-iam-policy-binding $BillingAccountId `
  --member="serviceAccount:$tfcSaEmail" `
  --role="roles/billing.costsManager" `
  --quiet | Out-Null

Step "授權 TFC SA：roles/billing.admin on $BillingAccountId（kill switch SA 需要 billing IAM 寫入）"
Invoke-Gcloud "add billing.admin binding" beta billing accounts add-iam-policy-binding $BillingAccountId `
  --member="serviceAccount:$tfcSaEmail" `
  --role="roles/billing.admin" `
  --quiet | Out-Null
Done "OK"

# ───────────────────────────────────────────────────────────
# 8. 允許 TFC workspace impersonate 該 SA
#    principal scope = 限定 organization + workspace name
# ───────────────────────────────────────────────────────────
Step "綁定：TFC workspace `"$TfcOrganization/$TfcWorkspace`" → impersonate $tfcSaEmail"
$projectNumber = (Invoke-Gcloud "describe project number" projects describe $ProjectId --format="value(projectNumber)").Trim()
if (-not $projectNumber) { throw "拿不到 project number、之前步驟可能失敗了" }
$poolName = "projects/$projectNumber/locations/global/workloadIdentityPools/$PoolId"

# 用 terraform_workspace_name 作為 principalSet attribute；最直接、最可靠。
# （早期版本用 terraform_full_workspace 但 TFC 在不同 project 下會送出不同
#   值，造成綁不上。terraform_workspace_name 直接是 workspace 名，乾淨。）
$principal = "principalSet://iam.googleapis.com/$poolName/attribute.terraform_workspace_name/$TfcWorkspace"

Invoke-Gcloud "add WIF binding" iam service-accounts add-iam-policy-binding $tfcSaEmail `
  --project=$ProjectId `
  --role="roles/iam.workloadIdentityUser" `
  --member=$principal `
  --quiet | Out-Null
Done "OK"

# ───────────────────────────────────────────────────────────
# 9. 印出要在 TFC workspace 設定的環境變數
# ───────────────────────────────────────────────────────────
$providerName = "projects/$projectNumber/locations/global/workloadIdentityPools/$PoolId/providers/$ProviderId"

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host " Bootstrap 完成！下一步：" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host " 到 https://app.terraform.io/app/$TfcOrganization/workspaces/$TfcWorkspace/variables"
Write-Host " 把以下『環境變數』(Environment variable，不是 Terraform variable) 設進去：" -ForegroundColor Yellow
Write-Host ""
Write-Host "   TFC_GCP_PROVIDER_AUTH              = true"
Write-Host "   TFC_GCP_RUN_SERVICE_ACCOUNT_EMAIL  = $tfcSaEmail"
Write-Host "   TFC_GCP_PROJECT_NUMBER             = $projectNumber"
Write-Host "   TFC_GCP_WORKLOAD_POOL_ID           = $PoolId"
Write-Host "   TFC_GCP_WORKLOAD_PROVIDER_ID       = $ProviderId"
Write-Host ""
Write-Host " 同一個 workspace 還要設定（Terraform variable，HCL 類型 string）：" -ForegroundColor Yellow
Write-Host ""
Write-Host "   gcp_project_id        = `"$ProjectId`""
Write-Host "   gcp_billing_account   = `"$BillingAccountId`"   （sensitive）"
Write-Host ""
Write-Host " Cloudflare / Sentry 用到時，再加環境變數："
Write-Host ""
Write-Host "   CLOUDFLARE_API_TOKEN  = ...   （sensitive）"
Write-Host "   SENTRY_AUTH_TOKEN     = ...   （sensitive）"
Write-Host ""
Write-Host "─── 全名供參考 ─────────────────────────────────────────────────"
Write-Host " WIF provider full name : $providerName"
Write-Host " TFC workspace principal : $principal"
Write-Host "────────────────────────────────────────────────────────────────"
Write-Host ""
Write-Host " 確認 TFC workspace 已切到正確 organization 後，回到專案根：" -ForegroundColor Cyan
Write-Host "   cd terraform; terraform login; terraform init"
Write-Host "   `$env:TF_WORKSPACE = `"$TfcWorkspace`""
Write-Host "   terraform plan -var-file=`"envs/$($TfcWorkspace -replace '^wattrent-', '').tfvars`""
Write-Host ""
