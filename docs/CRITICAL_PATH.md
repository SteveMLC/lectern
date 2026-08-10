# SpeakerOps Critical Path

The judging-critical product path is implemented on `main`. Six feature issues are closed; deployment remains blocked only by Cloudflare account authentication and the real D1 database id.

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
- 67 tests pass across domain, demo-loader, calendar, timezone, and Airtable adapter coverage.
- Local D1 API round trips verified decisions, direct sessions, agenda moves/conflicts, profile/task writes, R2 upload/download, communication delivery records, and calendar downloads.
- A fresh headed Groundwork walkthrough verified Reviews, Agenda, Speakers, Speaker Portal, Communications, Integrations, and persistent event switching with no console errors.

## Remaining External Blocker

`pnpm exec wrangler whoami` reports unauthenticated and `wrangler.jsonc` still contains the local-only placeholder D1 id. Deployment requires:

1. `pnpm exec wrangler login`
2. Provision or identify the production D1 database and R2 bucket.
3. Replace the placeholder D1 id in `wrangler.jsonc`.
4. Set `ORGANIZER_PASSCODE` (and optional Airtable credentials) as Worker secrets.
5. Apply migrations/seed, deploy, and run the production walkthrough.

Run `pnpm release:preflight` at any point for an executable check of the local release gates, Wrangler authentication, and D1/R2 configuration.

Do not flip the full judging demo to Airtable. D1 is the complete backend; Airtable is a documented bonus proof.

## Optional, Not MVP

- Accelevents mapping/CSV handoff.
- Real Resend delivery (simulated delivery is intentional and persisted).
- Dark mode and exhaustive mobile admin polish.
