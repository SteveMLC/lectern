# Lectern Submission Notes

## Listing Copy

**Name:** Lectern

**Tagline:** The open-source program side of Sessionboard.

**One-line pitch:** Collect CFP proposals, make program decisions, schedule sessions without double-booking rooms or speakers, and keep speakers on track—without an enterprise contract.

**Repository:** https://github.com/SteveMLC/lectern

**Demo URL:** https://lectern.lectern-go7.workers.dev

## What to Lead With

Lectern is an open-source, cloneable replacement for the core conference-program job. It treats submissions and sessions as different objects, supports direct sponsor/invited sessions, catches schedule conflicts, gives speakers a working portal, and publishes the resulting program. AI is optional seasoning, not the product claim.

## Judge-Proof Claims

| Claim | Evidence |
| --- | --- |
| Open-source replacement | Public MIT repository, documented local D1 setup, one Worker architecture |
| Complete program job | CFP → decision → session → agenda → speaker portal → communication → public embeds |
| Correct data model | Submission/session separation, lineage constraint, direct-session origin |
| Reliable scheduling | Pure tested conflict engine and visible live room/speaker overlaps |
| Real speaker operations | Profile/task D1 writes and R2 upload/download from the speaker link |
| Calendar handoff | Tested RFC 5545-style generator and downloadable `text/calendar` attachment |
| Airtable bonus | Live read/write mirror, 210 ms throttling, 429 retry, guarded reset/deduplication, 53 clean mapped records, and D1 fallback; strict production proof passes 6/6 |

## Production Checklist

- [x] Wrangler authenticated.
- [x] `pnpm release:preflight` passes.
- [x] Real D1 id replaces the placeholder.
- [x] R2 bucket exists.
- [x] `ORGANIZER_PASSCODE` is set as a Worker secret.
- [x] Migrations and deterministic seed applied remotely.
- [x] Deploy succeeds and `/api/health` reports DB + R2 healthy.
- [x] Load Groundwork at `/demo`, choose it in the admin event switcher, and rehearse the path above.
- [x] Test a fresh CFP submission and one speaker file upload on production.
- [x] Verify `.ics` downloads with `Content-Type: text/calendar`.
- [x] Check browser console and mobile-width admin navigation.
- [x] Run the guarded production reset twice: 53 clean Airtable mappings, 0 remaining duplicates/orphans, strict gate 6/6.
- [x] Add deployed URL here.
- [x] Record and decode-validate a clean 1280×720 walkthrough; local ignored submission cut is 2:59.76, and production was reset afterward.
- [x] Persist provider-reported counters for every runtime AI draft and export them into the append-only reimbursement ledger without request content.
- [ ] Add the organizer form URL when it is sent in Discord and submit with buffer.

## Submission Assets

- The walkthrough video was withdrawn from the submission package on 2026-08-12 (the brief requires no video). Local drafts stay in `output/playwright/` (ignored by git); declaring a `videoUrl` in `submission.json` re-arms every preflight video check.
- Machine-readable handoff: `submission.json` keeps the repository, demo, deadline, reimbursement cap, and eventual organizer-form URL in one validated place.
- The current official brief says the form will be sent out; it does not contain a submission-form URL as of August 10, 2026. Watch the organizer Discord before final submission.

Run `pnpm usage:runtime` after any production AI-assisted draft, then run `pnpm submission:preflight` immediately before upload. Preflight re-runs the release gate and strict production smoke test, fails if a persisted runtime event is missing from the ledger, checks the public GitHub repository, confirms the current commit is on `origin/main`, and reports a missing organizer-form URL or receipt evidence without inventing them. (Video checks are dormant while no `videoUrl` is declared.) Set `REQUIRE_SUBMISSION_URLS=1` for the final no-warning gate after the organizer form URL exists.

## Known Intentional Limits

- D1 is the full backend. Airtable mirrors the eight judging-relevant operational tables, but it is intentionally not in the request path.
- Email delivery is simulated and persisted; no external email is sent without credentials.
- Decision-feedback drafting is optional seasoning: the organizer always edits the draft, and the no-key/failure template deliberately excludes blunt internal notes.
- Agenda supports drag-and-drop room scheduling plus day, track, room, and list projections; explicit room/time controls remain as the precise keyboard/mobile fallback.
- Speaker portal links use stable demo tokens; expiring production magic links are not claimed.
