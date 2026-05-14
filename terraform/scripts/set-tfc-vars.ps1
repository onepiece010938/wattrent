#Requires -Version 5.1
<#
.SYNOPSIS
  Idempotently write all variables for a given HCP Terraform Cloud (TFC) workspace.

.DESCRIPTION
  Use this together with bootstrap.ps1: bootstrap stands up WIF / SA on the GCP
  side, and this script pushes the corresponding 'Environment variables' and
  'Terraform variables' onto the TFC workspace.

  - Reads the TFC API token from ~/.terraform.d/credentials.tfrc.json by default,
    or from the -Token parameter / $env:TFC_TOKEN.
  - PATCHes existing variables, POSTs new ones.
  - For sensitive variables, TFC does not return their value once they are
    marked sensitive; this script still issues PATCH to overwrite the value
    (this is intentional).

.PARAMETER Organization
  TFC organization name (e.g. wattrent)

.PARAMETER Workspace
  TFC workspace name (e.g. wattrent-staging)

.PARAMETER GcpProjectId
  GCP project ID (e.g. wattrent-staging)

.PARAMETER GcpProjectNumber
  GCP project number (digits only; printed at the end of bootstrap.ps1)

.PARAMETER GcpBillingAccount
  Billing account ID (XXXXXX-XXXXXX-XXXXXX); written as a sensitive value.

.PARAMETER GcpSaEmail
  TFC runner SA email (e.g. tfc-runner@wattrent-staging.iam.gserviceaccount.com)

.PARAMETER WorkloadPoolId
  WIF Pool ID (default tfc-pool)

.PARAMETER WorkloadProviderId
  WIF Provider ID (default tfc-provider)

.PARAMETER Token
  TFC API token; if omitted, attempts to read it from credentials.tfrc.json.

.PARAMETER TfcHost
  TFC host; defaults to app.terraform.io.

.EXAMPLE
  .\set-tfc-vars.ps1 `
    -Organization "wattrent" `
    -Workspace "wattrent-staging" `
    -GcpProjectId "wattrent-staging" `
    -GcpProjectNumber "<project number printed at the end of bootstrap.ps1>" `
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

# -- 1. Resolve token ------------------------------------------------
if (-not $Token) { $Token = $env:TFC_TOKEN }
if (-not $Token) {
  $credPath = Join-Path $env:APPDATA "terraform.d\credentials.tfrc.json"
  if (Test-Path $credPath) {
    try {
      $cred = Get-Content $credPath -Raw -Encoding UTF8 | ConvertFrom-Json
      $Token = $cred.credentials.$TfcHost.token
    } catch {
      Warn "Failed to read $credPath: $($_.Exception.Message)"
    }
  }
}
if (-not $Token) {
  throw "Could not locate a TFC API token. Run ``terraform login`` first, or pass -Token / set \$env:TFC_TOKEN."
}

# -- 2. Shared HTTP helper -------------------------------------------
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

# -- 3. Look up the workspace id -------------------------------------
Step "Look up workspace: $Organization/$Workspace"
$ws = Invoke-Tfc -Method GET -Path "/organizations/$Organization/workspaces/$Workspace"
$workspaceId = $ws.data.id
Done "workspace id = $workspaceId"

# -- 4. List existing variables --------------------------------------
Step "List existing variables on the workspace"
$existing = Invoke-Tfc -Method GET -Path "/workspaces/$workspaceId/vars"
$existingMap = @{}
foreach ($v in $existing.data) {
  $key = "$($v.attributes.category):$($v.attributes.key)"
  $existingMap[$key] = $v.id
}
Done "$($existing.data.Count) variables currently exist"

# -- 5. Define the variables to upsert -------------------------------
# category: env (environment variable) or terraform (Terraform variable)
$desired = @(
  @{ key="TFC_GCP_PROVIDER_AUTH";             value="true";                 category="env";       sensitive=$false; description="Enable TFC dynamic GCP credentials" },
  @{ key="TFC_GCP_RUN_SERVICE_ACCOUNT_EMAIL"; value=$GcpSaEmail;            category="env";       sensitive=$false; description="SA that TFC impersonates via WIF" },
  @{ key="TFC_GCP_PROJECT_NUMBER";            value=$GcpProjectNumber;      category="env";       sensitive=$false; description="GCP project number for WIF audience" },
  @{ key="TFC_GCP_WORKLOAD_POOL_ID";          value=$WorkloadPoolId;        category="env";       sensitive=$false; description="WIF pool id" },
  @{ key="TFC_GCP_WORKLOAD_PROVIDER_ID";      value=$WorkloadProviderId;    category="env";       sensitive=$false; description="WIF provider id" },
  @{ key="gcp_project_id";                    value=$GcpProjectId;          category="terraform"; sensitive=$false; description="GCP project id"; hcl=$false },
  @{ key="gcp_billing_account";               value=$GcpBillingAccount;     category="terraform"; sensitive=$true;  description="GCP billing account id"; hcl=$false }
)

# -- 6. Upsert -------------------------------------------------------
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
    Step "Update variable: [$($v.category)] $($v.key)"
    $body = @{ data = @{ id = $varId; type = "vars"; attributes = $attrs } }
    Invoke-Tfc -Method PATCH -Path "/workspaces/$workspaceId/vars/$varId" -Body $body | Out-Null
    Done "Updated"
  } else {
    Step "Create variable: [$($v.category)] $($v.key)"
    $body = @{ data = @{ type = "vars"; attributes = $attrs } }
    Invoke-Tfc -Method POST -Path "/workspaces/$workspaceId/vars" -Body $body | Out-Null
    Done "Created"
  }
}

Write-Host ""
Write-Host "===================================================================" -ForegroundColor Green
Write-Host " Done! Variables for workspace $Organization/$Workspace are ready." -ForegroundColor Green
Write-Host "===================================================================" -ForegroundColor Green
Write-Host ""
Write-Host " Next, you can run:"
Write-Host "   cd terraform"
Write-Host "   `$env:TF_WORKSPACE = `"$Workspace`""
Write-Host "   terraform init"
Write-Host "   terraform plan -var-file=`"envs/$($Workspace -replace '^wattrent-', '').tfvars`""
Write-Host ""
