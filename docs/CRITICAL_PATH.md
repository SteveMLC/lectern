# SpeakerOps Critical Path

The judging-critical product path is implemented on `main`. All six feature issues are production-proven, and the Cloudflare production deployment is live.

## Implemented and Verified

- Review queue with organizer Approve / Maybe / Deny decisions.
- Idempotent acceptance: repeated approval reuses the one session derived from the submission.
- Direct invited/sponsor sessions with `origin=direct` and no source submission.
- Drag-and-drop room scheduling with day, track, room, and list projections; exact room/time controls remain available, and room/speaker conflicts recompute immediately.
- Editable speaker portal: profile, task completion/reopen, and speaker-facing R2 uploads.
- Reminder and session-update previews, persisted simulated deliveries, and `.ics` downloads.
- Live Airtable mirror: eight SpeakerOps tables, idempotent record mapping, 210 ms request spacing, 429 retry, and D1 as the authoritative fallback.
- Public event, CFP, schedule/session/speaker embeds, API docs, deterministic seed, and Liam's Groundwork demo loader.
- Persistent organizer event switcher so the loaded Groundwork dataset is reachable from every admin screen.

Verification evidence:

- `pnpm verify` passes typecheck, tests, production build, and Worker deployment dry-run.
- `SPEAKEROPS_ORGANIZER_PASSCODE=... pnpm smoke:production` verifies the deployed Worker, D1/R2 health, public program data, embeds, calendar handoff, organizer data, and Airtable safety state without mutating judge data. Add `REQUIRE_AIRTABLE=1` for the strict bonus gate.
- Production deployment: https://speakerops.speakerops-go7.workers.dev
- Production `/api/health` reports `ok: true`, D1 healthy, and R2 bound.
- The full automated suite passes across domain, agenda drag placement, demo-loader, calendar, timezone, Airtable adapter, reimbursement integrity, guarded reset, and embed sanitization coverage; the current count is reported by `pnpm test` rather than frozen in this document.
- Local D1 API round trips verified decisions, direct sessions, agenda moves/conflicts, profile/task writes, R2 upload/download, communication delivery records, and calendar downloads.
- A fresh headed Groundwork walkthrough verified Reviews, Agenda, Speakers, Speaker Portal, Communications, Integrations, and persistent event switching with no console errors.
- An August 10 production walkthrough approved a seeded proposal, added and placed a direct sponsor session, surfaced the new conflict immediately, edited a speaker profile, completed a task, uploaded/downloaded an R2 asset, persisted a simulated send, and downloaded a valid `.ics`; the exact R2 test object was deleted and the deterministic remote seed restored afterward.
- An August 10 production agenda walkthrough dragged “Eval Pipelines That Do Not Lie” from Main Hall to Workshop Studio, persisted the intended session, reduced live conflicts from 2 to 1, verified list/room/day projections, and produced 0 console errors or warnings. The guarded reset then restored the pristine seed and strict Airtable gate.
- The guarded production reset is live and idempotent: it proved record-read scope before mutation, reconciled 53 live mappings, removed 53 duplicate and 2 stale QA rows on its cleanup run, preserved 15 template/hand-added rows, then passed a second reset with 0 duplicates, 0 orphans, and the strict production gate at 6/6.

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
