# ----------------------------------------------------------------------
# dns: Cloudflare -> Cloud Run domain mapping
#
# Cloud Run domain mapping can only CNAME to ghs.googlehosted.com.
# After the first apply, finish domain ownership verification in the GCP
# console (add a TXT record; can be added manually in Cloudflare).
# ----------------------------------------------------------------------

resource "cloudflare_record" "api" {
  zone_id = var.cloudflare_zone_id
  name    = var.api_fqdn
  content = "ghs.googlehosted.com"
  type    = "CNAME"
  ttl     = 1     # 1 = automatic
  proxied = false # Cloud Run already provides a Google-managed cert; bypassing CF proxy keeps things simple

  comment = "WattRent API -> Cloud Run domain mapping"
}
