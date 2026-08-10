# SpeakerOps Critical Path

The judging-critical product path is implemented on `main`. Six feature issues are closed, and the Cloudflare production deployment is live.

## Implemented and Verified

- Review queue with organizer Approve / Maybe / Deny decisions.
- Idempotent acceptance: repeated approval reuses the one session derived from the submission.
- Direct invited/sponsor sessions with `origin=direct` and no source submission.
- Room-based agenda placement with immediate room and speaker conflict detection.
- Editable speaker portal: profile, task completion/reopen, and speaker-facing R2 uploads.
- Reminder and session-update previews, persisted simulated deliveries, and `.ics` downloads.
- Airtable proof adapter: Events/Speakers reads, Messages write, cache, 5 req/s protection, 429 retry, and D1 fallback.
- Public event, CFP, schedule/session/speaker embeds, API docs, deterministic seed, and Liam's Groundwork demo loader.
- Persistent organizer event switcher so the loaded Groundwork dataset is reachable from every admin screen.

Verification evidence:

- `pnpm verify` passes typecheck, tests, production build, and Worker deployment dry-run.
- Production deployment: https://speakerops.speakerops-go7.workers.dev
- Production `/api/health` reports `ok: true`, D1 healthy, and R2 bound.
- 67 tests pass across domain, demo-loader, calendar, timezone, and Airtable adapter coverage.
- Local D1 API round trips verified decisions, direct sessions, agenda moves/conflicts, profile/task writes, R2 upload/download, communication delivery records, and calendar downloads.
- A fresh headed Groundwork walkthrough verified Reviews, Agenda, Speakers, Speaker Portal, Communications, Integrations, and persistent event switching with no console errors.

## Production Cloudflare Placement

Wrangler is authenticated as `sgovoni@gmail.com` against Cloudflare account `Sgovoni@gmail.com's Account`. SpeakerOps currently uses this account for:

- Worker: `speakerops`
- workers.dev subdomain: `speakerops-go7.workers.dev`
- D1 database: `speakerops-db`
- R2 bucket: `speakerops-assets`

This keeps the hackathon deployment isolated from Nealac/Qualora infrastructure. If SpeakerOps becomes a long-term product, it can be migrated into a consolidated Cloudflare account by exporting/importing D1 data and copying R2 objects.

Do not flip the full judging demo to Airtable. D1 is the complete backend; Airtable is a documented bonus proof.

## Optional, Not MVP

- Accelevents mapping/CSV handoff.
- Real Resend delivery (simulated delivery is intentional and persisted).
- Dark mode and exhaustive mobile admin polish.
