# SOP: Sponsor Import & Integrity Rules

## Source File
- Location: `assets/hope_sponsors_clean.csv`
- Header: `seq,company_name,type,primary_email,alt_emails,phone,website,email_raw,flags,status`

## Parsing & Cleaning Rules
1. Strip leading UTF-8 BOM if present.
2. `seq`: Integer identifier from CSV (1..485).
3. `ref_no`: Generated as `USM/SSI2627/HOPE/SLF/` + `seq.toString().padStart(2, '0')`.
4. `company_name`: Exact string from CSV, preserve original casing.
5. `display_name`: Defaults to `company_name.trim().replace(/\s+/g, ' ')`. Never auto-title-case.
6. `email_raw`: Untouched raw field from CSV.
7. `primary_email`:
   - If empty or "Not in source" or contains unusable text, set `email_status = 'no_email'`, `primary_email = null`.
   - Strip any trailing full stop (`.`).
   - Lowercase and trim.
8. Duplicate emails:
   - Group by lowercase `primary_email`.
   - The first row encountered retains queued/ready eligibility.
   - Subsequent rows with the same email get `email_status = 'shared_inbox'` and note `Shared inbox with <First Company Name>`.
9. Flags:
   - Freemail domains (`gmail.com`, `yahoo.com`, `ymail.com`, `hotmail.com`, `outlook.com`): set `flags = 'freemail'`.
   - Suspicious domain (`ricofood.com.my`): set `email_status = 'suspicious_domain'`.
10. Idempotency:
    - Target table `sponsors` has UNIQUE on `seq`.
    - `INSERT INTO sponsors ... ON CONFLICT(seq) DO UPDATE SET ...` preserving user edits (notes, owner, custom display_name, already_contacted).
