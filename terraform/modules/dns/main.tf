# ──────────────────────────────────────────────────────────────────────────
# dns: Cloudflare → Cloud Run domain mapping
#
# Cloud Run domain mapping 只能 CNAME 到 ghs.googlehosted.com。
# 第一次 apply 後要到 GCP console 完成 domain ownership 驗證
# （加 TXT record，可由 Cloudflare manual 加）。
# ──────────────────────────────────────────────────────────────────────────

resource "cloudflare_record" "api" {
  zone_id = var.cloudflare_zone_id
  name    = var.api_fqdn
  content = "ghs.googlehosted.com"
  type    = "CNAME"
  ttl     = 1     # 1 = automatic
  proxied = false # Cloud Run 已有 Google-managed cert，不走 CF proxy 較單純

  comment = "WattRent API → Cloud Run domain mapping"
}
