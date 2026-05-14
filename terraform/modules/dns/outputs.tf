output "record_id" {
  description = "Cloudflare DNS record ID"
  value       = cloudflare_record.api.id
}

output "fqdn" {
  description = "Full FQDN"
  value       = cloudflare_record.api.name
}
