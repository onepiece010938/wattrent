#Requires -Version 5.1
<#
.SYNOPSIS
  直接用 TFC REST API 上傳 terraform/ 目錄並觸發 remote plan/apply。
  在本地網路無法穩定 reach registry/releases.hashicorp.com 時，可繞過 terraform CLI。

.PARAMETER Workspace
  TFC workspace 名（例：wattrent-staging）

.PARAMETER Action
  plan / apply / plan-only。預設 plan-only（看 plan，不會 apply）

.PARAMETER Message
  Run 的描述

.PARAMETER Organization
  TFC 組織，預設 wattrent

.PARAMETER TfcHost
  TFC host，預設 app.terraform.io
#>

[CmdletBinding()]
Param(
  [Parameter(Mandatory=$true)][string]$Workspace,
  [ValidateSet("plan-only","plan-and-apply")][string]$Action = "plan-only",
  [string]$Message = "Triggered from local PowerShell ($(Get-Date -Format 'yyyy-MM-dd HH:mm'))",
  [string]$Organization = "wattrent",
  [string]$TfcHost = "app.terraform.io",
  [string]$Token,
  # 預設從 workspace 名推 env：wattrent-staging → staging、wattrent-production → production
  [string]$EnvName
)

$ErrorActionPreference = "Stop"

function Step($m) { Write-Host "==> $m" -ForegroundColor Cyan }
function Done($m) { Write-Host "    $m" -ForegroundColor Green }
function Info($m) { Write-Host "    $m" -ForegroundColor DarkGray }

# ── 1. token ─────────────────────────────────────────────────────
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

# ── 2. 找 workspace id ───────────────────────────────────────────
Step "查詢 workspace $Organization/$Workspace"
$ws = Invoke-RestMethod -Uri "$baseUrl/organizations/$Organization/workspaces/$Workspace" -Headers $jsonHeaders
$workspaceId = $ws.data.id
Done "workspace id = $workspaceId"

# ── 3. 把 terraform/ 打包成 tar.gz ──────────────────────────────
$repoRoot = Split-Path -Parent $PSScriptRoot   # scripts/ 的上層 = terraform/
# scripts 在 terraform/scripts/，所以 repoRoot = terraform/
$tfDir = $repoRoot

# 推 env 名（給 tfvars 命名用）
if (-not $EnvName) {
  if ($Workspace -match "^wattrent-(.+)$") { $EnvName = $Matches[1] }
  else { $EnvName = "staging" }
}
$tfvarsSrc = Join-Path $tfDir "envs/$EnvName.tfvars"
if (-not (Test-Path $tfvarsSrc)) {
  throw "找不到 var-file: $tfvarsSrc"
}
Info "env = $EnvName, tfvars = envs/$EnvName.tfvars (會打包成 terraform.auto.tfvars)"

Step "打包 $tfDir"

$tmpStage = Join-Path $env:TEMP "tfc-stage-$(Get-Random)"
$tmp = Join-Path $env:TEMP "tfc-cv-$(Get-Random).tar.gz"
New-Item -ItemType Directory -Path $tmpStage -Force | Out-Null
try {
  # robocopy 不會跟著 .terraform 等不必要目錄。/MIR 同步整個 tfDir
  $rcArgs = @(
    "$tfDir", "$tmpStage", "/E",
    "/XD", ".terraform", "scripts", ".build",
    "/XF", "*.tfstate", "*.tfstate.*", "*.tfplan", ".terraform.lock.hcl",
    "/NFL", "/NDL", "/NJH", "/NJS", "/NP"
  )
  & robocopy @rcArgs | Out-Null
  # robocopy exit code 0~7 都是成功（>=8 才算錯）
  if ($LASTEXITCODE -ge 8) { throw "robocopy failed (exit $LASTEXITCODE)" }
  $global:LASTEXITCODE = 0

  # 把 envs/$Env.tfvars 額外複製成 terraform.auto.tfvars（TFC remote 會自動載入）
  Copy-Item -Path $tfvarsSrc -Destination (Join-Path $tmpStage "terraform.auto.tfvars") -Force
  # envs/*.local.tfvars 不該打包
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

# ── 4. 建 configuration version ───────────────────────────────
Step "建立 configuration version"
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

# ── 5. 上傳 tarball ──────────────────────────────────────────
Step "上傳 tar.gz 到 TFC"
# upload-url 是 pre-signed S3，要 PUT raw bytes，不要 vnd.api+json
Invoke-WebRequest -Method PUT -Uri $uploadUrl -InFile $tmp -ContentType "application/octet-stream" -UseBasicParsing | Out-Null
Done "上傳完成"
Remove-Item $tmp -Force

# ── 6. 建 run ──────────────────────────────────────────────
Step "建立 run（$Action）"
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

# ── 7. Poll 進度 ────────────────────────────────────────────
$runUrl = "https://$TfcHost/app/$Organization/workspaces/$Workspace/runs/$runId"
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host " Run 已送出" -ForegroundColor Green
Write-Host " UI: $runUrl" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "等待 plan 完成..." -ForegroundColor DarkGray

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

# ── 8. 拉 plan log ─────────────────────────────────────────
$planId = $r.data.relationships.plan.data.id
Step "下載 plan log"
$planResp = Invoke-RestMethod -Uri "$baseUrl/plans/$planId" -Headers $jsonHeaders
$logUrl = $planResp.data.attributes."log-read-url"
$log = Invoke-WebRequest -Uri $logUrl -UseBasicParsing
Write-Host ""
Write-Host "─── plan log ─────────────────────────────────────────────────" -ForegroundColor DarkCyan
Write-Host $log.Content
Write-Host "──────────────────────────────────────────────────────────────" -ForegroundColor DarkCyan
Write-Host ""
Write-Host "Run UI: $runUrl" -ForegroundColor Cyan
