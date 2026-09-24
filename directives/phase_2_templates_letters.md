# SOP: Phase 2 Templates & Letters

## Directives
1. **Sacred Assets**:
   - `assets/HOPE Sponsorship Letter 26_27 Template.docx`: Treat as opaque binary asset. Never re-type text into code.
   - `assets/Sponsor Proposal HOPE 5.0.pdf`: Attached byte-for-byte unchanged.
   - Verbatim Email Script: Only `[Company Name]` changes.
2. **Letter Just-In-Time Generation**:
   - `generateLetter(company, now = new Date(), templateBytes)`:
     - Formats `dateText` in `Asia/Kuala_Lumpur` (MYT): `D MMMM YYYY` uppercase (e.g. `27 SEPTEMBER 2026`).
     - Paragraph-level replace for `USM/SSI2627/HOPE/SLF/01`.
     - Single run replace for `10 SEPTEMBER 2026`.
     - Regex replace for the 3 `[Recipient's Name/Organization]` occurrences.
     - XML-escapes company name.
     - Re-zips with `fflate`, storing media `.png` uncompressed (`level: 0`).
   - Strict Assertions:
     - No `[Recipient` remains anywhere in document.xml.
     - Old ref and old date no longer appear.
     - Exactly 3 company replacements, 1 ref and 1 date replacement made.
     - If assertions fail: throws error with reason `template error`.
3. **Acceptance Test**:
   - Golden test: Generated letter for `TEST & CO. SDN BHD` matches the template except ref, date, and 3 names.
   - Midnight boundary: 23:30 UTC on 26th is 07:30 MYT on 27th.
   - CPU target: Under 8 ms per letter generation.
