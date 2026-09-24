# SOP: Phase 1 Foundation & Idempotent CSV Import

## Goal
Establish the Cloudflare D1 database schema, Wrangler configurations for both workers (`hope-sponsor-hub` and `hope-pixel`), idempotent CSV import of all 485 sponsors, email validation pipeline with Cloudflare DoH, Cloudflare Access identity middleware, and dashboard skeleton with Sponsors and Problems tabs.

## Non-negotiables & Acceptance Criteria
1. Exactly 485 sponsor rows imported from `assets/hope_sponsors_clean.csv`.
2. 399 companies have email; 85 are "Not in source", 1 is unusable text ("Perbadanan Bandaraya Pulau Pinang") totaling 86 no-email rows.
3. 6 duplicate-email groups (13 companies sharing 6 distinct emails). The first company keeps queued-eligible status; the remaining become `shared_inbox` with `shared_with_company` naming the first company.
4. 46 freemail addresses flagged (`gmail.com`, `yahoo.com`, `hotmail.com`, etc.).
5. 1 suspicious domain flagged (`ricofood.com.my` or bogus hosting domain).
6. Immutable ref_no format: `USM/SSI2627/HOPE/SLF/` + zero-padded 2+ digits (e.g. 01..99, 100..485).
7. Idempotent import: re-running seed/import never duplicates rows and keeps `email_raw` intact.
8. Timezone: All timestamps stored in UTC ISO format, formatted in `Asia/Kuala_Lumpur` (UTC+8).
