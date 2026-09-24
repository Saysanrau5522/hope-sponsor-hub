# SOP: R2 Asset Storage & Pre-encoding

## Required Assets
1. **Proposal PDF**:
   - Source: `assets/Sponsor Proposal HOPE 5.0.pdf`
   - R2 Path: `assets/proposal.pdf`
   - Pre-encoded base64 path: `assets/proposal.base64`
   - *Rationale*: Pre-encoding the 1.7 MB PDF to base64 once saves ~40-60 ms of CPU per send, keeping CPU under the 10 ms limit on the Cloudflare Free plan.
2. **Sponsorship Letter Template DOCX**:
   - Source: `assets/HOPE Sponsorship Letter 26_27 Template.docx`
   - R2 Path: `assets/template.docx`
   - Binary DOCX template used by `fflate` for just-in-time generation.
3. **Sponsors Seed CSV**:
   - Source: `assets/hope_sponsors_clean.csv`
   - R2 Path: `assets/sponsors_seed.csv`

## Execution
Run `node execution/upload_assets.mjs --local` for local wrangler storage or `--remote` for Cloudflare R2 bucket.
