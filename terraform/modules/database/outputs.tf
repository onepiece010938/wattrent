output "database_name" {
  description = "Firestore database 名稱（永遠是 (default)）"
  value       = google_firestore_database.default.name
}

output "location" {
  description = "Firestore location"
  value       = google_firestore_database.default.location_id
}
