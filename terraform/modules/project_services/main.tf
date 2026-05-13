# ──────────────────────────────────────────────────────────────────────────
# project_services: 啟用 GCP API
# ──────────────────────────────────────────────────────────────────────────

resource "google_project_service" "this" {
  for_each = toset(var.apis)

  project = var.project_id
  service = each.value

  # 移除模組時不關閉 API（避免誤關別人也用的服務）
  disable_on_destroy         = false
  disable_dependent_services = false
}
