#Requires -Version 5.1
<#
.SYNOPSIS
  Upload the terraform/ directory directly via the TFC REST API and trigger a remote plan/apply.
  Useful as a workaround when local network connectivity to registry/releases.hashicorp.com is flaky.

.PARAMETER Workspace
  TFC workspace name (e.g. wattrent-staging)

.PARAMETER Action
  plan / apply / plan-only. Defaults to plan-only (run plan only, no apply).

.PARAMETER Message
  Run description.

.PARAMETER Organization
  TFC organization; defaults to wattrent.

.PARAMETER TfcHost
  TFC host; defaults to app.terraform.io.
#>

[CmdletBinding()]
Param(
  [Parameter(Mandatory=$true)][string]$Workspace,
  [ValidateSet("plan-only","plan-and-apply")][string]$Action = "plan-only",
  [string]$Message = "Triggered from local PowerShell ($(Get-Date -Format 'yyyy-MM-dd HH:mm'))",
  [string]$Organization = "wattrent",
  [string]$TfcHost = "app.terraform.io",
  [string]$Token,
  # Defaults to deriving env from the workspace name: wattrent-staging -> staging, wattrent-production -> production.
  [string]$EnvName
)

$ErrorActionPreference = "Stop"

function Step($m) { Write-Host "==> $m" -ForegroundColor Cyan }
function Done($m) { Write-Host "    $m" -ForegroundColor Green }
function Info($m) { Write-Host "    $m" -ForegroundColor DarkGray }

# -- 1. token --------------------------------------------------------
if (-not $Token) { $Token = $env:TFC_TOKEN }
if (-not $Token) {
  $credPath = Join-Path $env:APPDATA "terraform.d\credentials.tfrc.json"
  if (Test-Path $credPath) {
    $cred = Get-Content $credPath -Raw -Encoding UTF8 | ConvertFrom-Json
    $Token = $cred.credentials.$TfcHost.token
  }
}
if (-not $Token) { throw "No TFC token. Run 'terraform login' first." }

$baseUrl = "https://$TfcHost/api/v2"
$jsonHeaders = @{ "Authorization" = "Bearer $Token"; "Content-Type" = "application/vnd.api+json" }

# -- 2. Look up the workspace id -------------------------------------
Step "Look up workspace $Organization/$Workspace"
$ws = Invoke-RestMethod -Uri "$baseUrl/organizations/$Organization/workspaces/$Workspace" -Headers $jsonHeaders
$workspaceId = $ws.data.id
Done "workspace id = $workspaceId"

# -- 3. Pack terraform/ into a tar.gz --------------------------------
$repoRoot = Split-Path -Parent $PSScriptRoot   # parent of scripts/ = terraform/
# scripts lives at terraform/scripts/, so repoRoot = terraform/
$tfDir = $repoRoot

# Derive the env name (used for the tfvars filename).
if (-not $EnvName) {
  if ($Workspace -match "^wattrent-(.+)$") { $EnvName = $Matches[1] }
  else { $EnvName = "staging" }
}
$tfvarsSrc = Join-Path $tfDir "envs/$EnvName.tfvars"
if (-not (Test-Path $tfvarsSrc)) {
  throw "var-file not found: $tfvarsSrc"
}
Info "env = $EnvName, tfvars = envs/$EnvName.tfvars (will be packed as terraform.auto.tfvars)"

Step "Pack $tfDir"

$tmpStage = Join-Path $env:TEMP "tfc-stage-$(Get-Random)"
$tmp = Join-Path $env:TEMP "tfc-cv-$(Get-Random).tar.gz"
New-Item -ItemType Directory -Path $tmpStage -Force | Out-Null
try {
  # robocopy will not follow .terraform and similar directories. /MIR mirrors the entire tfDir.
  $rcArgs = @(
    "$tfDir", "$tmpStage", "/E",
    "/XD", ".terraform", "scripts", ".build",
    "/XF", "*.tfstate", "*.tfstate.*", "*.tfplan", ".terraform.lock.hcl",
    "/NFL", "/NDL", "/NJH", "/NJS", "/NP"
  )
  & robocopy @rcArgs | Out-Null
  # robocopy exit codes 0-7 are all success (>=8 means error)
  if ($LASTEXITCODE -ge 8) { throw "robocopy failed (exit $LASTEXITCODE)" }
  $global:LASTEXITCODE = 0

  # Copy envs/$Env.tfvars into the staging dir as terraform.auto.tfvars (TFC remote loads it automatically).
  Copy-Item -Path $tfvarsSrc -Destination (Join-Path $tmpStage "terraform.auto.tfvars") -Force
  # envs/*.local.tfvars must NOT be packaged.
  Get-ChildItem -Path (Join-Path $tmpStage "envs") -Filter "*.local.tfvars" -ErrorAction SilentlyContinue | Remove-Item -Force

  Push-Location $tmpStage
  try {
    & tar -czf $tmp .
    if ($LASTEXITCODE -ne 0) { throw "tar failed (exit $LASTEXITCODE)" }
  } finally { Pop-Location }
} finally {
  Remove-Item -Path $tmpStage -Recurse -Force -ErrorAction SilentlyContinue
}
$size = (Get-Item $tmp).Length
Done "$tmp ($([math]::Round($size/1KB,1)) KB)"

# -- 4. Create the configuration version -----------------------------
Step "Create configuration version"
$cvBody = @{
  data = @{
    type = "configuration-versions"
    attributes = @{
      "auto-queue-runs" = $false
      "speculative"     = ($Action -eq "plan-only")
    }
  }
} | ConvertTo-Json -Depth 5
$cvResp = Invoke-RestMethod -Method POST -Uri "$baseUrl/workspaces/$workspaceId/configuration-versions" -Headers $jsonHeaders -Body $cvBody
$cvId = $cvResp.data.id
$uploadUrl = $cvResp.data.attributes."upload-url"
Done "cv id = $cvId"

# -- 5. Upload the tarball -------------------------------------------
Step "Upload tar.gz to TFC"
# upload-url is a pre-signed S3 URL; PUT raw bytes, NOT vnd.api+json.
Invoke-WebRequest -Method PUT -Uri $uploadUrl -InFile $tmp -ContentType "application/octet-stream" -UseBasicParsing | Out-Null
Done "Upload complete"
Remove-Item $tmp -Force

# -- 6. Create the run -----------------------------------------------
Step "Create run ($Action)"
$autoApply = ($Action -eq "plan-and-apply")
$runBody = @{
  data = @{
    type = "runs"
    attributes = @{
      message       = $Message
      "auto-apply"  = $autoApply
      "plan-only"   = ($Action -eq "plan-only")
      "is-destroy"  = $false
    }
    relationships = @{
      workspace = @{ data = @{ type = "workspaces"; id = $workspaceId } }
      "configuration-version" = @{ data = @{ type = "configuration-versions"; id = $cvId } }
    }
  }
} | ConvertTo-Json -Depth 6
$runResp = Invoke-RestMethod -Method POST -Uri "$baseUrl/runs" -Headers $jsonHeaders -Body $runBody
$runId = $runResp.data.id
Done "run id = $runId"

# -- 7. Poll progress ------------------------------------------------
$runUrl = "https://$TfcHost/app/$Organization/workspaces/$Workspace/runs/$runId"
Write-Host ""
Write-Host "===================================================================" -ForegroundColor Green
Write-Host " Run submitted" -ForegroundColor Green
Write-Host " UI: $runUrl" -ForegroundColor Cyan
Write-Host "===================================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Waiting for the plan to finish..." -ForegroundColor DarkGray

$lastStatus = ""
$terminalStatuses = @(
  "applied","planned_and_finished","errored","canceled","discarded",
  "policy_soft_failed","policy_checked","cost_estimated"
)
$planFinishedStatuses = @(
  "planned","planned_and_finished","cost_estimated","policy_checked",
  "policy_soft_failed","policy_override","applied","errored","canceled","discarded"
)

while ($true) {
  Start-Sleep -Seconds 4
  try {
    $r = Invoke-RestMethod -Uri "$baseUrl/runs/$runId" -Headers $jsonHeaders
  } catch {
    Write-Host "    poll error: $($_.Exception.Message)" -ForegroundColor Yellow
    continue
  }
  $status = $r.data.attributes.status
  if ($status -ne $lastStatus) {
    Write-Host "    status: $status" -ForegroundColor Yellow
    $lastStatus = $status
  }
  if ($planFinishedStatuses -contains $status) { break }
}

# -- 8. Pull the plan log --------------------------------------------
$planId = $r.data.relationships.plan.data.id
Step "Download plan log"
$planResp = Invoke-RestMethod -Uri "$baseUrl/plans/$planId" -Headers $jsonHeaders
$logUrl = $planResp.data.attributes."log-read-url"
$log = Invoke-WebRequest -Uri $logUrl -UseBasicParsing
Write-Host ""
Write-Host "--- plan log -----------------------------------------------------" -ForegroundColor DarkCyan
Write-Host $log.Content
Write-Host "------------------------------------------------------------------" -ForegroundColor DarkCyan
Write-Host ""
Write-Host "Run UI: $runUrl" -ForegroundColor Cyan
