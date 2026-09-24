# SOP: Phase 3 Gmail & Open Tracking

## Objectives
1. **Google OAuth & Token Security**:
   - Scopes: `https://www.googleapis.com/auth/gmail.send` and `https://www.googleapis.com/auth/gmail.readonly`.
   - Encrypt refresh token with AES-GCM 256-bit using `TOKEN_ENCRYPTION_KEY`.
   - Store encrypted token in D1 `settings` table.
   - Access token cache in isolate memory between invocations.
2. **MIME Message Builder**:
   - RFC 2047 base64 encoded subject line (handles em dash `—`).
   - ASCII sanitized filenames for both attachments:
     - `Sponsor_Proposal_HOPE_5_0.pdf`
     - `HOPE_5_0_Sponsorship_Letter_<SafeSlug>.docx`
   - Pre-encoded base64 proposal from R2 (string concatenation).
   - Generated letter DOCX base64 attached.
   - Multipart/mixed containing multipart/alternative (plain text + HTML mirror with tracking pixel).
   - Message-ID: `<hope-${outreachId}@hope-sponsor-hub>`.
3. **Gmail Upload Send Endpoint**:
   - `https://gmail.googleapis.com/upload/gmail/v1/users/me/messages/send?uploadType=media`
   - `Content-Type: message/rfc822` (prevents double base64url wrapping).
4. **"Send test to myself"**:
   - Sends to the authenticated team user email with real proposal PDF and live letter dated today for `TEST & CO. SDN BHD`.
   - Injects unguessable tracking token.
