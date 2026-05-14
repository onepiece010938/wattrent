---
applyTo: "terraform/**"
description: "WattRent IaC (Terraform + GCP + Cloudflare + Sentry) guide"
---

# Infra — Terraform guide

> These rules auto-apply to every file under `terraform/**`.

## Overview

* Providers: `hashicorp/google`, `hashicorp/google-beta`, `cloudflare/cloudflare`, `jianyuan/sentry`, `hashicorp/random`
* Terraform version: `>= 1.10.0` (cloud{} workspaces with key:value tags require 1.10+; CI runs 1.15.x; OpenTofu 1.8+ also works)
* State: HCP Terraform Cloud (org `wattrent`)
* Two workspaces: `wattrent-staging`, `wattrent-production` (both tagged `app:wattrent` plus their own `env:` tag)
* Env files: `envs/staging.tfvars`, `envs/production.tfvars`

Full bootstrap steps live in [terraform/README.md](../../terraform/README.md).

## Module breakdown

| Module | Contents |
| --- | --- |
| `project_services` | Enable GCP APIs (every other module depends on this) |
| `database` | Firestore Native database (one per project) |
| `storage` | Meter-photo GCS bucket (single-region + lifecycle) |
| `auth` | Identity Platform config |
| `api` | Cloud Run + runtime SA + Artifact Registry + IAM + domain mapping + Gemini API key Secret |
| `cicd` | GitHub Actions Workload Identity Federation |
| `dns` | Cloudflare DNS records |
| `observability` | Sentry projects + Secret Manager (DSN) |

## Env / secrets

* `var.ai_backend`: `gemini` (default, AI Studio API key) or `vertex` (Vertex AI).
  * When `gemini`, the `api` module creates an empty `<service>-gemini-api-key` Secret Manager container.
    Push the actual key manually:
    `gcloud secrets versions add wattrent-api-gemini-api-key --data-file=-` and paste your AI Studio key contents.
* In the Cloud Run env block, `AI_BACKEND` / `GEMINI_MODEL` are plain text; `GEMINI_API_KEY` uses `secret_key_ref`.

## Naming

* GCP project: `wattrent-staging` / `wattrent-prod` (locals derives this automatically)
* Region: `asia-east1` (Changhua)
* GCS bucket: `wattrent-meters-{env}` (single-region `ASIA-EAST1`)
* Cloud Run service: `wattrent-api`
* Artifact Registry repo: `wattrent`
* Service-account suffixes: `{service-name}-run` / `github-actions`

## Coding conventions

* Every module ships three files: `main.tf`, `variables.tf`, `outputs.tf`.
* Every variable needs `description` and `type`; optional variables need `default`.
* Use `snake_case` for everything.
* Common labels (`{ app, env, managed-by }`) come from `locals.common_labels` at the root and are injected everywhere.
* Cross-module references use `module.x.output_name`; **never** hard-code project IDs.
* Use `count` for optional modules (e.g. `var.enable_sentry ? 1 : 0`); don't use `for_each` to fake a 0/1 toggle.

## Safety & guardrails

* The Cloud Run image tag is pushed by CI; Terraform uses `lifecycle.ignore_changes = [template[0].containers[0].image]` to avoid drift.
* Firestore is created with `delete_protection_state = "DELETE_PROTECTION_ENABLED"`, so an accidental destroy will not wipe data.
* GCS bucket: `uniform_bucket_level_access` + `public_access_prevention=enforced`, with versioning disabled.
* `disable_on_destroy = false` on API enablement: removing a module never disables an API (other resources may still need it).
* IAM: every service account is granted least privilege; the Cloud Run runtime SA must NEVER hold `roles/owner`.
* WIF `attribute_condition` pins the GitHub repo (`assertion.repository == ...`) for an extra guardrail.

## Don't do this

* ❌ Edit any resource in the console UI (the next apply will overwrite it).
* ❌ Write inline resources in the root `main.tf`; everything goes through a module.
* ❌ Commit a GCP service-account JSON key; auth always uses ADC + WIF.
* ❌ Put secrets in `*.tfvars`; secrets live in HCP TFC env vars or Secret Manager.
* ❌ Change `location_id` on the `(default)` Firestore database (immutable once created).
* ❌ Switch production Cloud Run `ingress` to `INGRESS_TRAFFIC_INTERNAL_*` without a load balancer (it will become unreachable).
* ❌ Skip `terraform plan` and apply directly; CI enforces plan first.

## Common commands

```powershell
cd terraform
terraform login                # First time: HCP TFC token
terraform init
terraform fmt -recursive
terraform validate

$env:TF_WORKSPACE = "wattrent-staging"
terraform plan  -var-file="envs/staging.tfvars"
terraform apply -var-file="envs/staging.tfvars"
```

## Deploy

* CI: [.github/workflows/infra.yml](../workflows/infra.yml)
  * PR: auto `terraform plan`, posts the plan as a PR comment
  * push to main: auto `terraform apply`
  * Manual: `workflow_dispatch` lets you pick env / action
* Auth: Workload Identity Federation (OIDC; no long-lived keys)

## Bootstrap chicken-and-egg

Terraform cannot manage the resources it depends on, so the following must be created manually first:

1. Create a GCP project and enable billing.
2. Create the HCP TFC organization and workspaces.
3. Create a bootstrap service account with `roles/owner`, generate a JSON key, paste it into the HCP TFC `GOOGLE_CREDENTIALS` env var.
4. Run the first apply (which creates the GitHub Actions WIF SA).
5. Copy the values of `terraform output github_actions_*` into the GitHub repo Secrets — from then on CI takes over.
