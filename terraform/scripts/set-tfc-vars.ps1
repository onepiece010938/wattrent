#Requires -Version 5.1
<#
.SYNOPSIS
  在 HCP Terraform Cloud (TFC) 一次寫入指定 workspace 的所有變數（idempotent）。

.DESCRIPTION
  搭配 bootstrap.ps1 之後使用：bootstrap 在 GCP 端建好 WIF / SA，
  本腳本則把對應的「Environment 變數」與「Terraform 變數」塞進 TFC workspace。

  - 自動從 ~/.terraform.d/credentials.tfrc.json 讀取 TFC API token，
    或者吃 -Token 參數 / $env:TFC_TOKEN。
  - 若變數已存在就 PATCH 更新，不存在就 POST 建立。
  - sensitive 變數一旦在 TFC 上是 sensitive，TFC 不回傳它的值，
    本腳本仍會發 PATCH 覆蓋寫入新值（這是預期行為）。

.PARAMETER Organization
  TFC 組織名（例：wattrent）

.PARAMETER Workspace
  TFC workspace 名（例：wattrent-staging）

.PARAMETER GcpProjectId
  GCP project ID（例：wattrent-staging）

.PARAMETER GcpProjectNumber
  GCP project number（純數字，bootstrap.ps1 結尾會印）

.PARAMETER GcpBillingAccount
  Billing account ID，格式 XXXXXX-XXXXXX-XXXXXX（會以 sensitive 寫入）

.PARAMETER GcpSaEmail
  TFC runner SA email（例：tfc-runner@wattrent-staging.iam.gserviceaccount.com）

.PARAMETER WorkloadPoolId
  WIF Pool ID（預設 tfc-pool）

.PARAMETER WorkloadProviderId
  WIF Provider ID（預設 tfc-provider）

.PARAMETER Token
  TFC API token；不給就嘗試從 credentials.tfrc.json 讀。

.PARAMETER TfcHost
  TFC host，預設 app.terraform.io。

.EXAMPLE
  .\set-tfc-vars.ps1 `
    -Organization "wattrent" `
    -Workspace "wattrent-staging" `
    -GcpProjectId "wattrent-staging" `
    -GcpProjectNumber "<bootstrap.ps1 結尾印的 project number>" `
    -GcpBillingAccount "XXXXXX-XXXXXX-XXXXXX" `
    -GcpSaEmail "tfc-runner@wattrent-staging.iam.gserviceaccount.com"
#>

[CmdletBinding()]
Param(
  [Parameter(Mandatory=$true)][string]$Organization,
  [Parameter(Mandatory=$true)][string]$Workspace,
  [Parameter(Mandatory=$true)][string]$GcpProjectId,
  [Parameter(Mandatory=$true)][string]$GcpProjectNumber,
  [Parameter(Mandatory=$true)][string]$GcpBillingAccount,
  [Parameter(Mandatory=$true)][string]$GcpSaEmail,
  [string]$WorkloadPoolId = "tfc-pool",
  [string]$WorkloadProviderId = "tfc-provider",
  [string]$Token,
  [string]$TfcHost = "app.terraform.io"
)

$ErrorActionPreference = "Stop"

function Step($msg) { Write-Host "==> $msg" -ForegroundColor Cyan }
function Done($msg) { Write-Host "    $msg" -ForegroundColor Green }
function Info($msg) { Write-Host "    $msg" -ForegroundColor DarkGray }
function Warn($msg) { Write-Host "    $msg" -ForegroundColor Yellow }

# ── 1. 取得 token ────────────────────────────────────────────────
if (-not $Token) { $Token = $env:TFC_TOKEN }
if (-not $Token) {
  $credPath = Join-Path $env:APPDATA "terraform.d\credentials.tfrc.json"
  if (Test-Path $credPath) {
    try {
      $cred = Get-Content $credPath -Raw -Encoding UTF8 | ConvertFrom-Json
      $Token = $cred.credentials.$TfcHost.token
    } catch {
      Warn "讀取 $credPath 失敗：$($_.Exception.Message)"
    }
  }
}
if (-not $Token) {
  throw "找不到 TFC API token。請先 ``terraform login`` 或傳 -Token / 設 \$env:TFC_TOKEN。"
}

# ── 2. 共用 HTTP helper ──────────────────────────────────────────
$baseUrl = "https://$TfcHost/api/v2"
$headers = @{
  "Authorization" = "Bearer $Token"
  "Content-Type"  = "application/vnd.api+json"
}

function Invoke-Tfc {
  Param(
    [Parameter(Mandatory=$true)][string]$Method,
    [Parameter(Mandatory=$true)][string]$Path,
    $Body
  )
  $url = "$baseUrl$Path"
  $jsonBody = $null
  if ($Body) { $jsonBody = $Body | ConvertTo-Json -Depth 10 -Compress }
  try {
    if ($jsonBody) {
      return Invoke-RestMethod -Method $Method -Uri $url -Headers $headers -Body $jsonBody
    } else {
      return Invoke-RestMethod -Method $Method -Uri $url -Headers $headers
    }
  } catch {
    $resp = $_.Exception.Response
    $detail = ""
    if ($resp -and $resp.GetResponseStream) {
      try {
        $reader = New-Object System.IO.StreamReader($resp.GetResponseStream())
        $detail = $reader.ReadToEnd()
      } catch {}
    }
    throw "TFC API $Method $Path failed: $($_.Exception.Message)`n$detail"
  }
}

# ── 3. 找 workspace id ───────────────────────────────────────────
Step "查詢 workspace：$Organization/$Workspace"
$ws = Invoke-Tfc -Method GET -Path "/organizations/$Organization/workspaces/$Workspace"
$workspaceId = $ws.data.id
Done "workspace id = $workspaceId"

# ── 4. 列出現有變數 ──────────────────────────────────────────────
Step "列出 workspace 既有變數"
$existing = Invoke-Tfc -Method GET -Path "/workspaces/$workspaceId/vars"
$existingMap = @{}
foreach ($v in $existing.data) {
  $key = "$($v.attributes.category):$($v.attributes.key)"
  $existingMap[$key] = $v.id
}
Done "目前共 $($existing.data.Count) 個變數"

# ── 5. 定義要寫入的變數 ──────────────────────────────────────────
# category: env (環境變數) 或 terraform (Terraform variable)
$desired = @(
  @{ key="TFC_GCP_PROVIDER_AUTH";             value="true";                 category="env";       sensitive=$false; description="Enable TFC dynamic GCP credentials" },
  @{ key="TFC_GCP_RUN_SERVICE_ACCOUNT_EMAIL"; value=$GcpSaEmail;            category="env";       sensitive=$false; description="SA that TFC impersonates via WIF" },
  @{ key="TFC_GCP_PROJECT_NUMBER";            value=$GcpProjectNumber;      category="env";       sensitive=$false; description="GCP project number for WIF audience" },
  @{ key="TFC_GCP_WORKLOAD_POOL_ID";          value=$WorkloadPoolId;        category="env";       sensitive=$false; description="WIF pool id" },
  @{ key="TFC_GCP_WORKLOAD_PROVIDER_ID";      value=$WorkloadProviderId;    category="env";       sensitive=$false; description="WIF provider id" },
  @{ key="gcp_project_id";                    value=$GcpProjectId;          category="terraform"; sensitive=$false; description="GCP project id"; hcl=$false },
  @{ key="gcp_billing_account";               value=$GcpBillingAccount;     category="terraform"; sensitive=$true;  description="GCP billing account id"; hcl=$false }
)

# ── 6. Upsert ────────────────────────────────────────────────────
foreach ($v in $desired) {
  $mapKey = "$($v.category):$($v.key)"
  $attrs = @{
    key         = $v.key
    value       = $v.value
    description = $v.description
    category    = $v.category
    hcl         = $false
    sensitive   = [bool]$v.sensitive
  }
  if ($existingMap.ContainsKey($mapKey)) {
    $varId = $existingMap[$mapKey]
    Step "更新變數：[$($v.category)] $($v.key)"
    $body = @{ data = @{ id = $varId; type = "vars"; attributes = $attrs } }
    Invoke-Tfc -Method PATCH -Path "/workspaces/$workspaceId/vars/$varId" -Body $body | Out-Null
    Done "已更新"
  } else {
    Step "建立變數：[$($v.category)] $($v.key)"
    $body = @{ data = @{ type = "vars"; attributes = $attrs } }
    Invoke-Tfc -Method POST -Path "/workspaces/$workspaceId/vars" -Body $body | Out-Null
    Done "已建立"
  }
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host " 完成！workspace $Organization/$Workspace 變數已就緒" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host " 接下來可以跑："
Write-Host "   cd terraform"
Write-Host "   `$env:TF_WORKSPACE = `"$Workspace`""
Write-Host "   terraform init"
Write-Host "   terraform plan -var-file=`"envs/$($Workspace -replace '^wattrent-', '').tfvars`""
Write-Host ""
