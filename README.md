# HOPE Sponsor Hub — HOPE 5.0 (Chase The Light)

> **Private Sponsorship & Outreach Platform**  
> Built for the HOPE 5.0 Sponsorship Team at **Sekretariat Sukarelawan India (SSI), Universiti Sains Malaysia**.  
> Target Funding Goal: **RM 10,140** | Total Corporate Sponsors: **485** (399 with email, 86 phone-only).

---

## 🎯 Executive Overview

**HOPE Sponsor Hub** is an automated, secure, and resilient web application designed to run entirely within the **Cloudflare Workers Free Tier** (10 ms CPU per invocation, 50 subrequests per invocation).

The system solves three mission-critical needs for the sponsorship team:
1. **Personalised Outreach**: Dispatches personalised emails from `hopebyssi@gmail.com` with a verbatim email template, byte-for-byte fixed Proposal PDF, and just-in-time dynamically generated official DOCX sponsorship letters.
2. **Engagement Tracking**: Tracks email delivery, read receipts (via a zero-cookie, transparent 43-byte GIF tracking pixel on a separate Cloudflare Worker `hope-pixel`), genuine human replies, auto-responders (out of office), and delivery bounces.
3. **Action-Oriented Follow-ups**: Identifies "Hot Leads" (2+ human opens in 24 hours) and calculates 7-calendar-day follow-ups in `Asia/Kuala_Lumpur` (UTC+8) time, supplying the team with a ranked calling list with one-click WhatsApp and phone actions.

---

## 🏗️ Architecture & Cloudflare Free Tier Optimization

```
                                          ┌────────────────────────────┐
                                          │  Recipients / Corporates   │
                                          └──────────────┬─────────────┘
                                                         │
                        Opens (1x1 GIF)                  │  Replies / Bounces
                               │                         │
                               ▼                         ▼
┌─────────────────────────────────────────┐   ┌────────────────────────────┐
│      hope-pixel Worker (Free Tier)      │   │   Gmail API (OAuth 2.0)    │
│  - Serving 43-byte transparent GIF      │   │   - upload/send (RFC 822)  │
│  - Prefetch & scanner bot detection     │   │   - inbox poll (max 20)    │
└────────────────────┬────────────────────┘   └──────────────┬─────────────┘
                     │                                       │
                     ▼ (Direct D1 Log)                       ▼ (Cron */5 * * * *)
┌──────────────────────────────────────────────────────────────────────────┐
│                   hope-sponsor-hub Worker (Free Tier)                    │
│                                                                          │
│  - Backend: Hono API routing                                             │
│  - Frontend: React 18 + Vite + TailwindCSS (static assets binding)       │
│  - Letter Generation: fflate run-level XML substitution (<6.5 ms CPU)    │
│  - MIME Assembly: Pre-encoded base64 PDF concatenation (<1.5 ms CPU)     │
│  - Pacing Engine: 09:00–16:30 MYT, 25->50->80 daily ramp, 60–180s jitter  │
│  - Database: Cloudflare D1 (SQLite) with batching (`db.batch()`)         │
│  - Storage: Cloudflare R2 (PDF proposal, letter template, daily backups) │
│  - Security: Cloudflare Access Identity + WebCrypto AES-GCM 256-bit      │
└──────────────────────────────────────────────────────────────────────────┘
```

### Free-Tier Resource Compliance Table

| Resource / Limitation | Cloudflare Limit | HOPE Sponsor Hub Consumption | Status |
| :--- | :--- | :--- | :--- |
| **Worker CPU Time** | 10 ms / invocation | **5.8 – 6.8 ms** (Letter DOCX + MIME builder) | ✅ Well within budget |
| **Subrequests (Send Tick)** | 50 / invocation | **3 subrequests** (Gmail Sent check + send + D1 update) | ✅ Well within budget |
| **Subrequests (Inbox Poll)** | 50 / invocation | **~22 subrequests** (1 list + 20 detail fetches + 1 D1 query) | ✅ Well within budget |
| **Subrequests (Validation)**| 50 / invocation | **25 subrequests** (Batched DoH MX/A queries) | ✅ Well within budget |
| **D1 Database Reads/Writes**| 5M reads / 100k writes day| Batched via `db.batch()` & indexed lookups | ✅ Well within budget |
| **R2 Storage** | 10 GB free tier | ~30 MB (assets + rolling daily snapshots) | ✅ Well within budget |

---

## 🚀 Quick Start (Local Development)

### 1. Prerequisites
- [Node.js](https://nodejs.org/) v20 or v22
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) v4 (`npm install -g wrangler` or via `npx`)

### 2. Install Dependencies
```bash
git clone https://github.com/your-org/hope-sponsor-hub.git
cd hope-sponsor-hub
npm install
```

### 3. Initialize Local D1 Database
Apply migrations and seed the 485 sponsors:
```bash
npm run db:migrate:local
npm run seed:local
```

### 4. Run Development Servers
In separate terminal tabs:
```bash
# Tab 1: Frontend Dev Server (Vite)
npm run dev

# Tab 2: Dashboard Worker (Hono + D1 Local)
npm run worker:dev

# Tab 3: Tracking Pixel Worker
npm run pixel:dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🔒 Configuration & Environment Variables

Copy `.env.example` to `.dev.vars` (this file is gitignored and will never be committed):
```ini
ENVIRONMENT=development
DRY_RUN=true
SEND_ENABLED=false
TOKEN_ENCRYPTION_KEY=your_32_byte_aes_key_here_12345678
GMAIL_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=your_google_client_secret
GMAIL_REDIRECT_URI=http://localhost:8787/api/gmail/callback
TRACKING_PIXEL_BASE_URL=http://localhost:8788
```

For production deployment on Cloudflare, configure secrets using Wrangler:
```bash
npx wrangler secret put TOKEN_ENCRYPTION_KEY
npx wrangler secret put GMAIL_CLIENT_ID
npx wrangler secret put GMAIL_CLIENT_SECRET
```

---

## 📬 Gmail OAuth 2.0 Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Create or select a project and configure the OAuth Consent Screen:
   - User Type: **External** (Publishing status: Testing or In Production).
   - Add test user: `hopebyssi@gmail.com`.
3. Create Credentials -> **OAuth client ID**:
   - Application Type: **Web Application**.
   - Authorized Redirect URIs:
     - Local: `http://localhost:8787/api/gmail/callback`
     - Remote: `https://hope-hub.yourdomain.workers.dev/api/gmail/callback`
4. Set Scopes:
   - `https://www.googleapis.com/auth/gmail.send`
   - `https://www.googleapis.com/auth/gmail.readonly`
   - `https://www.googleapis.com/auth/userinfo.email`
5. Visit the **Settings** or **Send Center** tab in HOPE Sponsor Hub and click **Connect Gmail** to authenticate. The refresh token is encrypted with AES-GCM 256-bit using WebCrypto and stored in D1.

---

## 🛡️ Standing Operational Rules

1. **Templates are Sacred**:
   - The email copy is used verbatim. Only `[Company Name]` changes.
   - The proposal PDF (`assets/proposal.pdf`) is attached byte-for-byte unchanged.
   - The letter DOCX is modified strictly in 3 locations: Reference Number, Date (`D MMMM YYYY` in MYT), and Company Name (3 locations). All headers, logos, bank details, and signatories remain byte-identical.
2. **Safety by Default**:
   - `SEND_ENABLED` defaults to `false` and `DRY_RUN` defaults to `true`.
   - Real emails are never sent automatically without human batch approval in the UI.
3. **Timezone Rule**:
   - All dates and calendar math use `Asia/Kuala_Lumpur` (UTC+8).
4. **Pacing Rules**:
   - Dispatches only run Monday to Friday between **09:00 and 16:30 MYT**.
   - Daily volume follows the ramp schedule: **25 -> 50 -> 80** emails/day.
   - Jitter interval between emails: **60 to 180 seconds**.

---

## 🧪 Testing & Verification

Run the full Vitest suite (covers CSV import, DoH DNS validation, MIME RFC 822 assembly, fflate DOCX golden tests, WebCrypto encryption, pacing queues, reply/bounce classification, and backup serialization):

```bash
npm test
```

### Running the End-to-End 391-Sponsor Simulation
To simulate batch approval and dispatch across all 391 valid sponsors in `DRY_RUN` mode:
```bash
node execution/simulate_dry_run_all.mjs
```

---

## 🚢 Production Deployment

```bash
# 1. Build the production frontend bundle
npm run build

# 2. Deploy database migrations to remote D1
npm run db:migrate:remote

# 3. Seed remote D1 database
npm run seed:remote

# 4. Upload static assets (PDF, DOCX template) to R2
npx wrangler r2 object put hope-assets/assets/proposal.pdf --file=assets/proposal.pdf --remote
npx wrangler r2 object put hope-assets/assets/template.docx --file="assets/HOPE Sponsorship Letter 26_27 Template.docx" --remote

# 5. Deploy Cloudflare Workers
npm run pixel:deploy
npm run worker:deploy
```

---

## 👥 Authors & Acknowledgments

- **Sekretariat Sukarelawan India (SSI)**, Universiti Sains Malaysia (USM).
- **HOPE 5.0 Sponsorship Team** — *Chase The Light*.
