# GitHub Actions Workflows

| Workflow | Trigger | Purpose |
| --- | --- | --- |
| [`ci.yml`](./ci.yml) | PR / push to main | Backend `gofmt` / `go vet` / `go test`; frontend `expo lint` / `tsc` |
| [`backend-deploy.yml`](./backend-deploy.yml) | push to main touching `backend/`; manual | Build -> push image -> deploy Cloud Run |
| [`frontend-update.yml`](./frontend-update.yml) | push to main touching `frontend/`; manual | EAS Update (OTA) |
| [`frontend-build.yml`](./frontend-build.yml) | manual | EAS Build (produces IPA / AAB) |
| [`infra.yml`](./infra.yml) | PR / push touching `terraform/`; manual | Terraform plan (PR) / apply (main) |
| [`firestore-deploy.yml`](./firestore-deploy.yml) | push to main touching `firestore/`; manual | Deploy Firestore rules + indexes |
| [`security.yml`](./security.yml) | PR / push / weekly Mondays | Gitleaks, Dependency Review, govulncheck, npm audit |

## Required Repository Variables (vars)

Settings -> Secrets and variables -> Actions -> **Variables**

| Scope | Name | Example |
| --- | --- | --- |
| Environment `staging` | `GCP_PROJECT_ID` | `wattrent-staging` |
| Environment `production` | `GCP_PROJECT_ID` | `wattrent-prod` |

## Required Repository Secrets

Settings -> Secrets and variables -> Actions -> **Secrets**

| Scope | Name | Content | Source |
| --- | --- | --- | --- |
| Repository | `GCP_WORKLOAD_IDENTITY_PROVIDER` | `projects/{number}/locations/global/workloadIdentityPools/github-pool/providers/github-provider` | `terraform output github_actions_workload_identity_provider` |
| Repository | `GCP_DEPLOY_SA_EMAIL` | `github-actions@wattrent-{env}.iam.gserviceaccount.com` | `terraform output github_actions_service_account` |
| Repository | `TF_API_TOKEN` | HCP Terraform Cloud user token | <https://app.terraform.io/app/settings/tokens> |
| Repository | `EXPO_TOKEN` | EAS personal access token | <https://expo.dev/accounts/[account]/settings/access-tokens> |

> No `GOOGLE_CREDENTIALS` is needed! Everything runs through OIDC; no long-lived GCP key ever ends up in GitHub.

## Environments

We recommend creating two Environments (Settings -> Environments):

- **`staging`** — auto-deploy, no reviewer
- **`production`** — add a required reviewer (even just yourself, as a sanity check)

## NOTE: production is currently locked

Right now every deploy workflow (`infra.yml`, `backend-deploy.yml`, `firestore-deploy.yml`,
`frontend-update.yml`) only exposes `staging` in its `workflow_dispatch` inputs.
Add `production` back to the `options` array right before submitting the app to Google Play / App Store.
Reasons: avoid fat-fingering a deploy, keep cost down (no extra Cloud Run / Firestore running), and prevent IAM/secret drift in prod.
(The Terraform state still keeps the `wattrent-production` workspace, so unlocking is trivial.)

## Before running infra for the first time

1. Bootstrap from `terraform/README.md` is complete (GCP project created, HCP TFC configured)
2. The very first `terraform apply` must run on a developer laptop (GH Actions has no WIF SA yet)
3. After getting `terraform output`, paste the WIF provider / SA email into GitHub Secrets
4. Only then can GH Actions take over subsequent applies
