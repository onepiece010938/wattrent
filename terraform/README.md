# WattRent Terraform / OpenTofu Layout

> Manages GCP (Cloud Run, Firestore, GCS, optional Vertex AI, Identity Platform, budget kill-switch) + Cloudflare DNS + Sentry + Gemini API key Secret.

---

## Design principles

1. **Zero long-lived keys** — both TFC and GitHub Actions use OIDC + Workload Identity Federation; no GCP service account JSON key ever touches disk or a secret store.
2. **Hard budget cap** — when the monthly budget hits 100%, billing is automatically disabled; Cloud Run starts returning 503, Firestore drops to read-only-cache, **so you cannot be overcharged**.
3. **State on HCP TFC** — two workspaces (`wattrent-staging` / `wattrent-production`) consume their own `tfvars`; state is NOT in git.
4. **Modular** — the root module only composes; every resource lives inside `modules/*`.
5. **No clicking in the console** — except for the one-shot bootstrap below, every change goes through PR + plan + apply.

## Layout

```
terraform/
├── README.md            ← this file
├── versions.tf          ← Terraform / Provider versions
├── backend.tf           ← State backend (HCP Terraform Cloud)
├── providers.tf         ← Provider config (auth via ADC / TFC dynamic credentials)
├── variables.tf         ← Top-level inputs
├── locals.tf            ← Shared locals (project ID, API list, labels)
├── main.tf              ← Module composition
├── outputs.tf           ← Consumed by GitHub Actions and the frontend
├── envs/
│   ├── staging.tfvars
│   └── production.tfvars
├── scripts/
│   ├── bootstrap.ps1    ← One-shot: stand up TFC WIF, SA, IAM
│   └── set-tfc-vars.ps1 ← One-shot: write the TFC env/tf variables in one go (idempotent)
└── modules/
    ├── project_services/   ← Enable GCP APIs
    ├── api/                ← Cloud Run + Service Account + IAM + Artifact Registry
    ├── database/           ← Firestore database (Native mode)
    ├── storage/            ← GCS bucket (meter photos + lifecycle)
    ├── auth/               ← Identity Platform configuration
    ├── cicd/               ← GitHub Actions Workload Identity Federation
    ├── dns/                ← Cloudflare records
    ├── observability/      ← Sentry project
    └── billing/            ← Budget + Pub/Sub + Kill-switch Cloud Function
```

---

## One-shot bootstrap (run once per environment)

> Terraform cannot manage "the resources that Terraform itself depends on"
> (who creates the very first SA?). We package this step into a PowerShell
> script that wires up the TFC WIF setup so you never have to touch it again.

### 0. Install tooling

```powershell
# Skip whatever you already have
winget install Google.CloudSDK
winget install Hashicorp.Terraform
winget install Cloudflare.cloudflared    # Needed later
```

> WARNING: winget does NOT add the new tools to PATH for the current PowerShell session,
> so open a new window (or run `refreshenv`) before `gcloud` / `terraform` / `cloudflared` resolve.
>
> If `where.exe gcloud` still cannot find it, append these three directories to your user PATH (set once, persists forever):
>
> ```text
> %LOCALAPPDATA%\Google\Cloud SDK\google-cloud-sdk\bin
> %LOCALAPPDATA%\Microsoft\WinGet\Packages\Hashicorp.Terraform_Microsoft.Winget.Source_8wekyb3d8bbwe
> %LOCALAPPDATA%\Microsoft\WinGet\Packages\Cloudflare.cloudflared_Microsoft.Winget.Source_8wekyb3d8bbwe
> ```

#### Install `gcloud beta` (required for the billing commands)

The winget build of gcloud locks the component manager, so a plain `gcloud components install beta` fails with "Cannot use bundled Python ... in non-interactive mode".
Use the official workaround:

```powershell
$env:CLOUDSDK_PYTHON = (gcloud components copy-bundled-python | Select-Object -Last 1).Trim()
gcloud components install beta --quiet
Remove-Item Env:CLOUDSDK_PYTHON
gcloud beta --help        # verify
```

Log in:

```powershell
gcloud auth login
gcloud auth application-default login    # also required for local terraform plan
```

### 1. Create the HCP Terraform Cloud organization + workspaces

Go to <https://app.terraform.io>:

1. Create the organization; the suggested name is `wattrent`
2. Create two workspaces:
   - `wattrent-staging`
   - `wattrent-production`

   **Workflow type: `CLI-driven`** (NOT VCS-driven, NOT API-driven):
   - Our GitHub Actions ([.github/workflows/infra.yml](../.github/workflows/infra.yml)) drive TFC through `terraform plan/apply` CLI, which from TFC's perspective is the CLI workflow.
   - VCS-driven would make TFC subscribe to GitHub webhooks itself and double-trigger alongside GH Actions.
   - API-driven is meant for people writing custom orchestrators; we don't need it.

3. Tag both workspaces (purely for grouping; **does NOT affect execution**):
   * Old single-field UI -> enter `wattrent`
   * New key/value UI -> add `app=wattrent` and `env=staging` (use `env=production` for the production workspace)
   * If unsure just Skip; you can change it later
4. In each workspace -> **Settings -> General -> Execution Mode** -> **keep as `Remote`** (the default).
   * Remote: plan/apply runs on the TFC cloud runner and can pick up the OIDC dynamic credentials we configure.
   * Local: TFC is only used as a state backend, dynamic credentials stop working (you'd have to fall back to a SA key); **do NOT pick this**.

### 2. Run the bootstrap script

```powershell
cd terraform\scripts

.\bootstrap.ps1 `
  -ProjectId        "wattrent-staging" `
  -BillingAccountId "0X0X0X-0X0X0X-0X0X0X" `
  -TfcOrganization  "wattrent" `
  -TfcWorkspace     "wattrent-staging"

# Production environment
.\bootstrap.ps1 `
  -ProjectId        "wattrent-prod" `
  -BillingAccountId "0X0X0X-0X0X0X-0X0X0X" `
  -TfcOrganization  "wattrent" `
  -TfcWorkspace     "wattrent-production"
```

What the script does (fully idempotent, safe to re-run):

| Step | Action |
| --- | --- |
| 1 | `gcloud projects create` to create the GCP project (or skip) |
| 2 | `gcloud beta billing projects link` to attach billing |
| 3 | Enable the APIs needed for bootstrap (`iam` / `iamcredentials` / `cloudresourcemanager` / `sts` / `serviceusage`) |
| 4 | Create Workload Identity Pool `tfc-pool` |
| 5 | Create Pool Provider `tfc-provider` with issuer = `https://app.terraform.io` and an attribute_condition pinned to the organization |
| 6 | Create SA `tfc-runner@{project}.iam.gserviceaccount.com` |
| 7 | Grant the SA `roles/owner` (project) + `roles/billing.user` & `roles/billing.costsManager` (billing account) |
| 8 | Bind: `principalSet://.../attribute.terraform_full_workspace/...workspace:{workspace}` -> `workloadIdentityUser` on the SA |
| 9 | Print the env vars to paste into the TFC workspace |

### 3. Push variables into the TFC workspace (automated)

Don't want to add them in the TFC UI one by one? Use [`set-tfc-vars.ps1`](./scripts/set-tfc-vars.ps1) to write all 5 env vars + 2 Terraform vars in one shot (`gcp_billing_account` is automatically marked sensitive). Idempotent: existing keys get PATCHed.

Run `terraform login` once first (it stores the token in `%APPDATA%\terraform.d\credentials.tfrc.json`), then:

```powershell
cd terraform\scripts

# Staging
.\set-tfc-vars.ps1 `
  -Organization      "wattrent" `
  -Workspace         "wattrent-staging" `
  -GcpProjectId      "wattrent-staging" `
  -GcpProjectNumber  "<project number printed by bootstrap>" `
  -GcpBillingAccount "0X0X0X-0X0X0X-0X0X0X" `
  -GcpSaEmail        "tfc-runner@wattrent-staging.iam.gserviceaccount.com"

# Production
.\set-tfc-vars.ps1 `
  -Organization      "wattrent" `
  -Workspace         "wattrent-production" `
  -GcpProjectId      "wattrent-prod" `
  -GcpProjectNumber  "<project number printed by bootstrap>" `
  -GcpBillingAccount "0X0X0X-0X0X0X-0X0X0X" `
  -GcpSaEmail        "tfc-runner@wattrent-prod.iam.gserviceaccount.com"
```

If you prefer the UI, go to `https://app.terraform.io/app/{org}/workspaces/{workspace}/variables` and add the same 7 variables manually:

**Environment variables** (NOT Terraform variables):

| Key | Value |
| --- | --- |
| `TFC_GCP_PROVIDER_AUTH` | `true` |
| `TFC_GCP_RUN_SERVICE_ACCOUNT_EMAIL` | (the SA email printed by the script) |
| `TFC_GCP_PROJECT_NUMBER` | (the project number printed by the script) |
| `TFC_GCP_WORKLOAD_POOL_ID` | `tfc-pool` |
| `TFC_GCP_WORKLOAD_PROVIDER_ID` | `tfc-provider` |

**Terraform variables**:

| Key | Value | Sensitive |
| --- | --- | --- |
| `gcp_project_id` | `wattrent-staging` / `wattrent-prod` | no |
| `gcp_billing_account` | `0X0X0X-0X0X0X-0X0X0X` | **yes** |

After this, every TFC plan/apply will automatically:
1. Get a short-lived token from its own OIDC issuer
2. Exchange it at GCP STS for a federated token
3. Impersonate the `tfc-runner@` SA
4. Write short-lived ADC into the runner container -> the google provider picks it up

The whole flow involves **no long-lived key** ever leaving GCP.

### 4. Third-party API tokens (Cloudflare / Sentry, add when you need them)

Same Environment variable form, with sensitive enabled:

| Key | Purpose | Minimum scope |
| --- | --- | --- |
| `CLOUDFLARE_API_TOKEN` | dns module | Zone:Read + DNS:Edit on the zone |
| `SENTRY_AUTH_TOKEN` | observability module | `project:write`, `project:read` |

### 5. First apply

```powershell
cd terraform
terraform login        # First TFC login (browser pops up)
terraform init

$env:TF_WORKSPACE = "wattrent-staging"
terraform plan  -var-file="envs/staging.tfvars"
terraform apply -var-file="envs/staging.tfvars"
```

After the first successful apply, copy the outputs into GitHub repo Secrets so GH Actions can use them:

```powershell
terraform output -raw github_actions_workload_identity_provider
terraform output -raw github_actions_service_account
```

These map to GitHub repo Settings -> Secrets:
- `GCP_WORKLOAD_IDENTITY_PROVIDER_STAGING`
- `GCP_DEPLOY_SA_EMAIL_STAGING`

Repeat for production.

---

## Hard budget cap (kill switch)

### Why this exists

GCP has **no** built-in switch for "automatically disable services when a budget is hit"; only alert emails.
The `billing` module implements the officially recommended hard cap:

```
Monthly budget
   │ Hit 50% / 90% -> email (notify only, services stay up)
   ▼
   100% reached
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
   │  calls cloudbilling.projects.updateBillingInfo
   │  body = { billingAccountName: "" }
   ▼
Project billing -> DISABLED
   │
   ▼
Cloud Run 503 / Firestore writes fail / Gemini OCR refuses
(reads of own metadata and Cloud Logging continue to work)
```

You MUST be aware of the side effects:

* Once triggered, the app is hard-down until you manually restore it -> **this is the design goal**: never get overcharged.
* Once billing is disabled, Firestore **enters read-only cache mode**; new writes always fail. Data **is NOT lost**.
* To re-attach billing: `gcloud beta billing projects link {project} --billing-account=...`; recovery within ~5 minutes.
* The Cloud Function itself is also a paid service, but the very last invocation before billing is disabled has already done its job.

### How to configure

In [envs/staging.tfvars](envs/staging.tfvars) / [envs/production.tfvars](envs/production.tfvars):

```hcl
billing_budget_amount        = 5     # USD/month
billing_budget_currency      = "USD" # MUST match the billing account currency
billing_alert_thresholds     = [0.5, 0.9]   # email only
billing_kill_switch_enabled  = true   # <- the "refuse traffic" switch
```

* **Want alerts only, no kill** -> `billing_kill_switch_enabled = false`; only emails are sent
* **Want to refuse traffic at 50%** -> `billing_alert_thresholds = []` and `billing_budget_amount = your-50%-amount`
* The budget currency must match the billing account currency. GCP accounts opened with a Taiwan credit card are usually USD, but some are TWD; check at <https://console.cloud.google.com/billing>

### How to test the kill switch

To avoid actually waiting for the month-end overrun, you can publish a fake message manually:

```powershell
gcloud pubsub topics publish billing-budget-alerts `
  --project=wattrent-staging `
  --message='{"costAmount":1000,"budgetAmount":1,"costIntervalStart":"2026-05-01T00:00:00Z"}'

# Read the function log
gcloud functions logs read billing-killer `
  --region=asia-east1 --project=wattrent-staging --gen2
```

After testing, do not forget to re-attach the billing account:

```powershell
gcloud beta billing projects link wattrent-staging `
  --billing-account=XXXXXX-XXXXXX-XXXXXX
```

---

## Day-to-day operation

```powershell
cd terraform
terraform login                # First time: log in to HCP TFC
terraform init

# Switch workspace
$env:TF_WORKSPACE = "wattrent-staging"
terraform plan  -var-file="envs/staging.tfvars"
terraform apply -var-file="envs/staging.tfvars"

$env:TF_WORKSPACE = "wattrent-production"
terraform plan  -var-file="envs/production.tfvars"
terraform apply -var-file="envs/production.tfvars"
```

CI/CD goes through [.github/workflows/infra.yml](../.github/workflows/infra.yml): PRs auto-plan, main auto-applies.

---

## Division of labor with other tools

| Task | Owned by |
| --- | --- |
| GCP resources (Cloud Run, Firestore, GCS, IAM, Budget, etc.) | Terraform |
| Firestore rules / indexes deploy | `firebase deploy --only firestore:rules,firestore:indexes` (run by GitHub Actions) |
| Cloud Run image build & push | GitHub Actions (auth via WIF) |
| Cloud Run deploy (image tag bump) | GitHub Actions (`gcloud run deploy --image=...`) |
| Secret values | Secret Manager (Terraform creates the secret container; CI/CD writes the value) |
| Frontend OTA | EAS Update (GitHub Actions) |

---

## TODO (in priority order)

### P0: must-do before production launch

- [ ] **Run bootstrap twice**
  Finish `bootstrap.ps1` for both environments and configure the 5 `TFC_GCP_*` variables in each TFC workspace. Without this, TFC will hard-fail on auth.

- [ ] **Set `gcp_billing_account`**
  Both `envs/*.tfvars` ship with the placeholder `XXXXXX-XXXXXX-XXXXXX`; plan will be blocked by `validation`. Grab the value from <https://console.cloud.google.com/billing>.

- [ ] **Verify the kill switch actually stops things**
  Run the "How to test the kill switch" command above and confirm the `BILLING DISABLED on projects/...` log appears, then re-attach billing. **An untested kill switch is a non-existent kill switch.**

- [ ] **Set `github_repository` and apply for the first time**
  `envs/*.tfvars` defaults `github_repository = ""`, which makes the cicd module skip the WIF principal binding -> GitHub Actions cannot reach GCP. Fill it in, then apply.

### P1: handle within the first month after launch

- [ ] **Domain verification & DNS apply**
  - In the GCP Cloud Run console -> Manage Custom Domains -> add `api.wattrent.app` -> get the TXT record
  - Add the TXT record in Cloudflare DNS (manual; **the GCP API does not expose this step to Terraform**)
  - Once verified, set `cloudflare_zone_id` + `domain_root` in `production.tfvars` and apply
  - Only then will the `dns` module create the CNAME

- [ ] **OAuth providers (Google / Apple sign-in)**
  - Identity Platform's OAuth IdPs cannot be set up 100% via Terraform (the OAuth client secret has to be created in Google Cloud Console first)
  - Flow: APIs & Services -> Credentials -> Create OAuth client ID -> grab Client ID + Secret -> fill into new variables in the `auth` module (TBD)
  - For full automation use `google_identity_platform_oauth_idp_config`, but you still have to prepare the client secret first
  - For now: enable in the Identity Platform UI and `terraform import` later

- [ ] **Cloud Monitoring notification channel**
  Today, budget alerts only go to the default email of the billing account (the one you set when first configuring billing).
  To send to LINE Notify / Slack:
  1. Cloud Monitoring -> Notification Channels -> create a webhook
  2. Append the channel ID: `billing_notification_channels = ["projects/{p}/notificationChannels/{id}"]`
  3. apply

- [ ] **PR preview environments**
  Today the WIF principalSet of the `cicd` module is "any branch / PR in the repo can impersonate the deploy SA" (good enough).
  To get "one isolated Cloud Run revision per PR":
  - Add a new workflow under [.github/workflows/](../.github/workflows/) that listens to PR events
  - `gcloud run deploy wattrent-api-pr-{number} --no-traffic --tag=pr-{number}`
  - On PR close: `gcloud run services delete wattrent-api-pr-{number}`
  - No Terraform changes needed; Cloud Run revisions are dynamic

### P2: future improvements

- [ ] **Least-privilege SA**
  `tfc-runner` currently has `roles/owner`. Split it down:
  - `roles/run.admin`, `roles/firestore.admin`, `roles/storage.admin`, `roles/iam.serviceAccountAdmin`, `roles/resourcemanager.projectIamAdmin`, `roles/cloudfunctions.admin`, `roles/billing.user`
  - Add what's missing as you hit `403 Permission denied` logs

- [ ] **Multi-region failover**
  Today everything lives in `asia-east1` (Changhua). Firestore Native does not support cross-region failover; for DR you would have to switch to a `nam5`/`eur3` multi-region database (immutable once chosen).
  Cloud Run multi-region: use a Global External LB plus services in two regions.

- [ ] **Cost anomaly detection**
  `google_billing_budget` is an "absolute amount"; it cannot detect "spend in this period suddenly grew 10x". Cloud Monitoring has anomaly detection alert policies that could be added.

- [ ] **Terraform import of existing resources**
  If you ever created something manually in the console, run `terraform import` to pull it in and avoid future apply conflicts.

- [ ] **`gcloud beta` -> `gcloud`**
  `bootstrap.ps1` uses `gcloud beta billing`; switch back to the main command once the API GAs.

---

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| `Error: Failed to retrieve credentials` (TFC plan) | The TFC workspace is missing the `TFC_GCP_*` env vars, or bootstrap never bound the WIF principal |
| `Error: googleapi: Error 403: Permission ...` | The `tfc-runner` SA is missing a role. Quickest: `roles/owner`; correct: find the matching role and add it |
| `Error: Resource ... already exists` (first apply) | The resource was created manually in the console. Pull it in with `terraform import` |
| `Cloud Run service suddenly all-503` | **Possibly the kill switch fired!** Check Cloud Logging -> `resource.type="cloud_run_revision"` and the billing-killer function log |
| `Identity Platform: PROJECT_NOT_FOUND` | The `auth` module fails on `google_identity_platform_config`; enable Identity Platform once in the console first ($0) |
| `Error: required field is not set` (provider) | `gcp_billing_account` is empty, or the `validation` regex does not match |

---

## References

- [HCP TFC Dynamic Credentials with GCP](https://developer.hashicorp.com/terraform/cloud-docs/workspaces/dynamic-provider-credentials/gcp-configuration)
- [Cap project costs by automatically disabling Cloud Billing](https://cloud.google.com/billing/docs/how-to/disable-billing-with-notifications)
- [Cloud Run with Workload Identity Federation from GitHub Actions](https://github.com/google-github-actions/auth#workload-identity-federation-via-a-service-account)
- [Identity Platform vs Firebase Auth](https://cloud.google.com/identity-platform/docs/product-comparison)
