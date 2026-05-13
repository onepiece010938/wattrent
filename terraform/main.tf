# ──────────────────────────────────────────────────────────────────────────
# 模組組合（root → modules/*）
# ──────────────────────────────────────────────────────────────────────────

# ─────────────── 取得 project number（給 budget filter / WIF 用） ───────────────
data "google_project" "current" {
  project_id = local.gcp_project_id
}

# ─────────────── 啟用 API（其他模組都依賴這個） ───────────────
module "project_services" {
  source = "./modules/project_services"

  project_id = local.gcp_project_id
  apis       = local.enabled_apis
}

# ─────────────── 物件儲存（電表照片） ───────────────
module "storage" {
  source = "./modules/storage"

  project_id   = local.gcp_project_id
  bucket_name  = local.meters_bucket_name
  location     = var.gcp_storage_location
  labels       = local.common_labels

  depends_on = [module.project_services]
}

# ─────────────── Firestore database ───────────────
module "database" {
  source = "./modules/database"

  project_id = local.gcp_project_id
  location   = var.gcp_region
  labels     = local.common_labels

  depends_on = [module.project_services]
}

# ─────────────── Identity Platform（Auth） ───────────────
module "auth" {
  source = "./modules/auth"

  project_id         = local.gcp_project_id
  authorized_domains = concat(
    var.auth_authorized_domains,
    var.domain_root != "" ? [var.domain_root] : [],
  )

  depends_on = [module.project_services]
}

# ─────────────── Cloud Run API ───────────────
module "api" {
  source = "./modules/api"

  project_id        = local.gcp_project_id
  region            = var.gcp_region
  service_name      = local.api_service_name
  image             = var.api_image
  min_instances     = var.api_min_instances
  max_instances     = var.api_max_instances
  cpu               = var.api_cpu
  memory            = var.api_memory
  meters_bucket     = module.storage.bucket_name
  env               = var.env
  api_fqdn          = local.api_fqdn
  sentry_dsn_secret = var.enable_sentry ? module.observability[0].sentry_dsn_secret_id : ""
  labels            = local.common_labels

  depends_on = [
    module.project_services,
    module.database,
    module.storage,
  ]
}

# ─────────────── GitHub Actions OIDC（Workload Identity Federation） ───────────────
module "cicd" {
  source = "./modules/cicd"

  project_id              = local.gcp_project_id
  github_repository       = var.github_repository
  cloud_run_service_name  = module.api.service_name
  cloud_run_location      = var.gcp_region
  meters_bucket           = module.storage.bucket_name
  artifact_registry_repo  = module.api.artifact_registry_repo

  depends_on = [module.project_services, module.api]
}

# ─────────────── DNS（Cloudflare → Cloud Run domain mapping） ───────────────
module "dns" {
  count  = var.cloudflare_zone_id != "" && var.domain_root != "" ? 1 : 0
  source = "./modules/dns"

  cloudflare_zone_id = var.cloudflare_zone_id
  api_fqdn           = local.api_fqdn
  cloud_run_url      = module.api.service_url
}

# ─────────────── Sentry（可選） ───────────────
module "observability" {
  count  = var.enable_sentry ? 1 : 0
  source = "./modules/observability"

  project_id          = local.gcp_project_id
  env                 = var.env
  sentry_organization = var.sentry_organization
}

# ─────────────── Budget + kill switch（避免被多收錢） ───────────────
module "billing" {
  source = "./modules/billing"

  project_id            = local.gcp_project_id
  project_number        = data.google_project.current.number
  billing_account       = var.gcp_billing_account
  env                   = var.env
  region                = var.gcp_region
  amount                = var.billing_budget_amount
  currency              = var.billing_budget_currency
  alert_thresholds      = var.billing_alert_thresholds
  enable_kill_switch    = var.billing_kill_switch_enabled
  notification_channels = var.billing_notification_channels
  labels                = local.common_labels

  depends_on = [module.project_services]
}
