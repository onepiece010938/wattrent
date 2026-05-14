output "bucket_name" {
  description = "GCS bucket name"
  value       = google_storage_bucket.meters.name
}

output "bucket_url" {
  description = "gs:// URL"
  value       = google_storage_bucket.meters.url
}
