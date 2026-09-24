# SOP: Email Validation Pipeline

## Constraints (Free Tier Cloudflare Workers)
- Max 50 subrequests per invocation.
- Process in chunks of 25 domains/emails per batch.
- Resumable: check unvalidated emails or track `validated_at`.

## Stages of Validation
1. **Syntax Check & Cleanup**:
   - Strip leading/trailing whitespace, punctuation.
   - Regex check: RFC 5322 simplified pattern.
   - If invalid format: flag `email_status = 'invalid_format'`.
2. **Cloudflare DoH MX Lookup**:
   - Domain extracted from email address.
   - Query: `https://cloudflare-dns.com/dns-query?name=${domain}&type=MX`
   - Headers: `accept: application/dns-json`
   - If MX Answer has entries with type 15, MX is valid.
   - If no MX records returned, query A record `https://cloudflare-dns.com/dns-query?name=${domain}&type=A`.
   - If neither MX nor A record exists, flag `email_status = 'no_mx'`.
3. **Contact Quality Classification**:
   - `csr_or_foundation`: matches patterns `csr`, `foundation`, `yayasan`, `sustainability`, `corporate`, `sponsor` in email, company name, or type.
   - `generic_inbox`: local part starts with or equals `info@`, `enquiry@`, `careline@`, `customercare@`, `support@`, `hello@`, `feedback@`.
   - `standard`: all other valid corporate domains.
4. **Ordering & Priority**:
   - Offer priority sorting: CSR/Foundation first, standard next, generic inboxes last.
