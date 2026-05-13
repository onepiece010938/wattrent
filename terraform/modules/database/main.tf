# ──────────────────────────────────────────────────────────────────────────
# database: Firestore (Native mode)
#
# 注意：每個 GCP project 只能有一個 default Firestore database，
# 一旦建立就無法改 location。
#
# Rules / indexes 由 GitHub Actions 用 firebase CLI 部署
# （把 firestore/firestore.rules + firestore.indexes.json 推上去）
# ──────────────────────────────────────────────────────────────────────────

resource "google_firestore_database" "default" {
  project     = var.project_id
  name        = "(default)"
  location_id = var.location
  type        = "FIRESTORE_NATIVE"

  # 防止資料庫被誤刪（只有 ABANDON 才允許 destroy 不刪資料）
  delete_protection_state = "DELETE_PROTECTION_ENABLED"
  deletion_policy         = "DELETE"

  concurrency_mode            = "OPTIMISTIC"
  app_engine_integration_mode = "DISABLED"

  point_in_time_recovery_enablement = "POINT_IN_TIME_RECOVERY_ENABLED"
}
