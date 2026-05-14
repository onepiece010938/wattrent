output "database_name" {
  description = "Firestore database name (always (default))"
  value       = google_firestore_database.default.name
}

output "location" {
  description = "Firestore location"
  value       = google_firestore_database.default.location_id
}
