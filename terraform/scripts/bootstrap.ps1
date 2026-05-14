# ──────────────────────────────────────────────────────────────────────────
# WattRent Terraform Bootstrap (one-shot)
#
# Goal: stand up the Workload Identity setup that HCP Terraform Cloud uses to
#       impersonate a GCP SA, WITHOUT ever issuing a long-lived service account key.
#
# After this script runs, the TFC workspace can manage GCP via OIDC dynamic
# credentials. There will be no long-lived GCP key on your laptop, on TFC, or in GitHub.
#
# Prerequisites:
#   1. gcloud CLI, firebase CLI, and terraform CLI are installed.
#   2. You are logged into a GCP account that can manage billing (`gcloud auth login`).
#   3. The HCP TFC organization plus both workspaces already exist:
#        - {org}/wattrent-staging
#        - {org}/wattrent-production
#      (Workflow type: CLI-driven.)
#
# Usage:
#   .\bootstrap.ps1 `
#     -ProjectId        "wattrent-staging" `
#     -BillingAccountId "0X0X0X-0X0X0X-0X0X0X" `
#     -TfcOrganization  "wattrent" `
#     -TfcWorkspace     "wattrent-staging"
#
# Run once per environment (staging / production).
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

# Run gcloud and check the exit code. On failure, throw an exception so the
# script does not keep going while the project is in a bad state.
# Note: temporarily lower ErrorActionPreference to Continue, because gcloud
# writes progress messages (e.g. "Create in progress for...") to stderr, which
# Stop mode would otherwise treat as a failure.
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

# Existence-check helper: runs gcloud describe / list and returns $true / $false
# without throwing. Avoids native command stderr being treated as a terminating
# error under EAP=Stop.
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
# 0. Pre-flight checks
# ───────────────────────────────────────────────────────────
Step "Check that gcloud is logged in"
$account = (gcloud config get-value account 2>$null).Trim()
if (-not $account) { throw "Run 'gcloud auth login' first" }
Info "Logged-in account: $account"

# ───────────────────────────────────────────────────────────
# 1. Create / confirm the GCP project
# ───────────────────────────────────────────────────────────
Step "Ensure GCP project: $ProjectId"
if (-not (Test-GcloudExists projects describe $ProjectId --format="value(projectId)")) {
  Info "Creating project..."
  # Display name cannot contain (); only letters/digits/spaces/hyphens/single quotes are allowed.
  $displayName = "$ProjectName $ProjectId"
  Invoke-Gcloud "projects create" projects create $ProjectId --name=$displayName --quiet | Out-Null
  Done "Created $ProjectId"
} else {
  Done "Already exists, skipping create"
}

# ───────────────────────────────────────────────────────────
# 2. Link the billing account
# ───────────────────────────────────────────────────────────
Step "Link billing account: $BillingAccountId"
Invoke-Gcloud "billing link" beta billing projects link $ProjectId --billing-account=$BillingAccountId --quiet | Out-Null
Done "Linked"

# ───────────────────────────────────────────────────────────
# 3. Enable the APIs needed during bootstrap.
#    (Other APIs are turned on later by the Terraform project_services module.)
# ───────────────────────────────────────────────────────────
Step "Enable APIs required for bootstrap"
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
# 4. Create the Workload Identity Pool (for TFC)
# ───────────────────────────────────────────────────────────
Step "Create Workload Identity Pool: $PoolId"
$poolExists = Test-GcloudExists iam workload-identity-pools describe $PoolId `
  --project=$ProjectId --location="global" --format="value(name)"
if (-not $poolExists) {
  Invoke-Gcloud "WIF pool create" iam workload-identity-pools create $PoolId `
    --project=$ProjectId `
    --location="global" `
    --display-name="HCP Terraform Cloud" `
    --description="OIDC pool for HCP Terraform Cloud dynamic credentials" `
    --quiet | Out-Null
  Done "Created"
} else {
  Done "Already exists, skipping"
}

# ───────────────────────────────────────────────────────────
# 5. Create the Workload Identity Pool Provider (trust the TFC OIDC issuer).
#    attribute_condition restricts the provider to tokens from the configured organization.
# ───────────────────────────────────────────────────────────
Step "Create Workload Identity Pool Provider: $ProviderId"
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

# WIF audience: the GCP convention is //iam.googleapis.com/<provider_full_name>.
# TFC sends exactly this by default, so allowed-audiences must match
# (cannot be set to https://...).
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
  Done "Created"
} else {
  Step "Update allowed-audiences on the existing WIF provider (no-op if already correct)"
  Invoke-Gcloud "WIF provider update audience" iam workload-identity-pools providers update-oidc $ProviderId `
    --project=$ProjectId `
    --location="global" `
    --workload-identity-pool=$PoolId `
    --allowed-audiences=$allowedAudience `
    --quiet | Out-Null
  Done "Updated"
}

# ───────────────────────────────────────────────────────────
# 6. Create the TFC runner service account
# ───────────────────────────────────────────────────────────
$tfcSaEmail = "$TfcSaName@$ProjectId.iam.gserviceaccount.com"
Step "Create TFC runner SA: $tfcSaEmail"

$saExists = Test-GcloudExists iam service-accounts describe $tfcSaEmail `
  --project=$ProjectId --format="value(email)"
if (-not $saExists) {
  Invoke-Gcloud "sa create" iam service-accounts create $TfcSaName `
    --project=$ProjectId `
    --display-name="HCP Terraform Cloud runner" `
    --description="TFC impersonates this SA via WIF; no key issued" `
    --quiet | Out-Null
  Done "Created"
  Info "Wait for the SA to propagate globally in IAM (avoids NotFound on the next binding)..."
  Start-Sleep -Seconds 30
} else {
  Done "Already exists, skipping"
}

# ───────────────────────────────────────────────────────────
# 7. Grant the TFC SA the roles it needs.
#    Note: roles/owner is "full project". Terraform creates IAM bindings,
#          enables APIs, edits Cloud Run config, etc.; granting owner is the
#          simplest one-shot. For least privilege, swap to Editor + a curated
#          set of admin roles instead.
# ───────────────────────────────────────────────────────────
Step "Grant TFC SA: roles/owner on $ProjectId"
Invoke-Gcloud "add owner binding" projects add-iam-policy-binding $ProjectId `
  --member="serviceAccount:$tfcSaEmail" `
  --role="roles/owner" `
  --condition=None `
  --quiet | Out-Null
Done "OK"

Step "Grant TFC SA: roles/billing.user on $BillingAccountId (so the budget module can create budgets)"
Invoke-Gcloud "add billing.user binding" beta billing accounts add-iam-policy-binding $BillingAccountId `
  --member="serviceAccount:$tfcSaEmail" `
  --role="roles/billing.user" `
  --quiet | Out-Null

Step "Grant TFC SA: roles/billing.costsManager on $BillingAccountId"
Invoke-Gcloud "add billing.costsManager binding" beta billing accounts add-iam-policy-binding $BillingAccountId `
  --member="serviceAccount:$tfcSaEmail" `
  --role="roles/billing.costsManager" `
  --quiet | Out-Null

Step "Grant TFC SA: roles/billing.admin on $BillingAccountId (the kill-switch SA needs to write billing IAM)"
Invoke-Gcloud "add billing.admin binding" beta billing accounts add-iam-policy-binding $BillingAccountId `
  --member="serviceAccount:$tfcSaEmail" `
  --role="roles/billing.admin" `
  --quiet | Out-Null
Done "OK"

# ───────────────────────────────────────────────────────────
# 8. Allow the TFC workspace to impersonate the SA.
#    principal scope = pinned to organization + workspace name.
# ───────────────────────────────────────────────────────────
Step "Bind: TFC workspace `"$TfcOrganization/$TfcWorkspace`" -> impersonate $tfcSaEmail"
$projectNumber = (Invoke-Gcloud "describe project number" projects describe $ProjectId --format="value(projectNumber)").Trim()
if (-not $projectNumber) { throw "Could not look up project number; an earlier step likely failed" }
$poolName = "projects/$projectNumber/locations/global/workloadIdentityPools/$PoolId"

# Use terraform_workspace_name as the principalSet attribute; it is the most direct and reliable choice.
# (Earlier versions used terraform_full_workspace, but TFC sends different
#  values across projects, which broke the binding. terraform_workspace_name
#  is the bare workspace name, so it is clean.)
$principal = "principalSet://iam.googleapis.com/$poolName/attribute.terraform_workspace_name/$TfcWorkspace"

Invoke-Gcloud "add WIF binding" iam service-accounts add-iam-policy-binding $tfcSaEmail `
  --project=$ProjectId `
  --role="roles/iam.workloadIdentityUser" `
  --member=$principal `
  --quiet | Out-Null
Done "OK"

# ───────────────────────────────────────────────────────────
# 9. Print the env vars to set on the TFC workspace.
# ───────────────────────────────────────────────────────────
$providerName = "projects/$projectNumber/locations/global/workloadIdentityPools/$PoolId/providers/$ProviderId"

Write-Host ""
Write-Host "===================================================================" -ForegroundColor Green
Write-Host " Bootstrap complete! Next steps:" -ForegroundColor Green
Write-Host "===================================================================" -ForegroundColor Green
Write-Host ""
Write-Host " Open https://app.terraform.io/app/$TfcOrganization/workspaces/$TfcWorkspace/variables"
Write-Host " and add the following 'environment variables' (Environment variable, NOT Terraform variable):" -ForegroundColor Yellow
Write-Host ""
Write-Host "   TFC_GCP_PROVIDER_AUTH              = true"
Write-Host "   TFC_GCP_RUN_SERVICE_ACCOUNT_EMAIL  = $tfcSaEmail"
Write-Host "   TFC_GCP_PROJECT_NUMBER             = $projectNumber"
Write-Host "   TFC_GCP_WORKLOAD_POOL_ID           = $PoolId"
Write-Host "   TFC_GCP_WORKLOAD_PROVIDER_ID       = $ProviderId"
Write-Host ""
Write-Host " On the same workspace, also add (Terraform variable, HCL type string):" -ForegroundColor Yellow
Write-Host ""
Write-Host "   gcp_project_id        = `"$ProjectId`""
Write-Host "   gcp_billing_account   = `"$BillingAccountId`"   (sensitive)"
Write-Host ""
Write-Host " Add these env vars later when Cloudflare / Sentry are needed:"
Write-Host ""
Write-Host "   CLOUDFLARE_API_TOKEN  = ...   (sensitive)"
Write-Host "   SENTRY_AUTH_TOKEN     = ...   (sensitive)"
Write-Host ""
Write-Host "--- Full names (for reference) ---------------------------------"
Write-Host " WIF provider full name : $providerName"
Write-Host " TFC workspace principal : $principal"
Write-Host "----------------------------------------------------------------"
Write-Host ""
Write-Host " Once the TFC workspace is on the right organization, go back to the project root:" -ForegroundColor Cyan
Write-Host "   cd terraform; terraform login; terraform init"
Write-Host "   `$env:TF_WORKSPACE = `"$TfcWorkspace`""
Write-Host "   terraform plan -var-file=`"envs/$($TfcWorkspace -replace '^wattrent-', '').tfvars`""
Write-Host ""
