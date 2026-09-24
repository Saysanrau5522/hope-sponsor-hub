# SOP: Phase 4 Queue and Pacing Engine

## Principles & Non-Negotiables
1. **Safety Controls**:
   - `SEND_ENABLED`: Global kill switch. When false, zero emails are sent.
   - `DRY_RUN`: Defaults to true during building and testing.
   - Human Batch Approval: Nothing enters the queue until human approves on the review screen.
2. **Pacing Rules**:
   - Send window: Monday–Friday, 09:00–16:30 MYT. No sending outside this window.
   - Daily cap ramp: 25 -> 50 -> 80 sends per business day.
   - Random jitter: 60s to 180s gap between sends.
   - The minute cron (`* * * * *`) processes at most one due outreach per invocation.
3. **Idempotency & Retries**:
   - Unique RFC 822 Message-ID per outreach: `<hope-${outreachId}@hope-sponsor-hub>`.
   - Before sending, check Gmail Sent folder using `rfc822msgid` to prevent double sending if a worker crashed post-send.
   - Network / 5xx errors: Retry with backoff up to 3 times (`next_due_at = now + 5min * retry_count`).
   - 4xx errors from Gmail (e.g. invalid recipient): Mark `status = 'failed'` immediately with reason.
4. **Sent Letter Snapshot**:
   - The exact DOCX bytes attached to the email are saved to R2 at `sent/<ref>-<company-slug>.docx`.
