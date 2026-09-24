# Standing rules: HOPE Sponsor Hub
- Templates are sacred. Never edit, re-type, "improve" or re-flow the email copy, the proposal PDF, or the letter DOCX. Only the fields named in the build prompt may change, and only through code covered by a golden test.
- Never send a real email while building. SEND_ENABLED defaults to false and DRY_RUN defaults to true. Real sends happen only after a human approves a batch in the UI.
- Never commit secrets. Use `wrangler secret put` and a gitignored `.dev.vars`.
- All dates and times are Asia/Kuala_Lumpur (UTC+8). Workers run in UTC, so convert explicitly every time.
- Target the Cloudflare Workers FREE plan: 10 ms CPU per invocation, 50 subrequests per invocation (fetch, D1, R2 and KV calls all count). Use `db.batch()`. If something cannot fit, stop and tell me; do not silently require a paid plan.
- Do not add paid services or heavy dependencies without asking.
- After each phase: run tests, summarise what changed, and list anything you were unsure about.