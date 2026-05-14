# ----------------------------------------------------------------------
# database: Firestore (Native mode)
#
# Note: each GCP project can only have ONE default Firestore database, and
# its location cannot be changed once created.
#
# Rules / indexes are deployed by GitHub Actions via the firebase CLI
# (pushing firestore/firestore.rules + firestore.indexes.json).
# ----------------------------------------------------------------------

resource "google_firestore_database" "default" {
  project     = var.project_id
  name        = "(default)"
  location_id = var.location
  type        = "FIRESTORE_NATIVE"

  # Prevent the database from being accidentally destroyed (only ABANDON allows destroy without deleting data)
  delete_protection_state = "DELETE_PROTECTION_ENABLED"
  deletion_policy         = "DELETE"

  concurrency_mode            = "OPTIMISTIC"
  app_engine_integration_mode = "DISABLED"

  point_in_time_recovery_enablement = "POINT_IN_TIME_RECOVERY_ENABLED"
}
