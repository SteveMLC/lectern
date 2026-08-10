# SpeakerOps Submission Notes

## Listing Copy

**Name:** SpeakerOps

**Tagline:** The open-source program side of Sessionboard.

**One-line pitch:** Collect CFP proposals, make program decisions, schedule sessions without double-booking rooms or speakers, and keep speakers on track—without an enterprise contract.

**Repository:** https://github.com/SteveMLC/speakerops

**Demo URL:** https://speakerops.speakerops-go7.workers.dev

## What to Lead With

SpeakerOps is an open-source, cloneable replacement for the core conference-program job. It treats submissions and sessions as different objects, supports direct sponsor/invited sessions, catches schedule conflicts, gives speakers a working portal, and publishes the resulting program. AI is optional seasoning, not the product claim.

## Three-Minute Walkthrough

1. **0:00–0:20 — Frame the replacement.** Open the Groundwork organizer dashboard. Say: “This is the program side of Sessionboard, open source and deployable on one Cloudflare Worker.”
2. **0:20–0:55 — Decide a proposal.** Open Reviews, choose a submitted proposal, click Approve, and point out that it becomes one session. Re-approval reuses the same session rather than duplicating it.
3. **0:55–1:15 — Prove sessions are not submissions.** Open Agenda and add a sponsor keynote directly. Point to the Direct badge and explain that it has no source submission.
4. **1:15–1:45 — Schedule with guardrails.** Place or move the session into an occupied room/time. Show the immediate room/speaker conflict language, then move it clear.
5. **1:45–2:15 — Speaker workflow.** Open Speakers, choose a confirmed speaker, and enter their portal. Edit the bio, complete a task, and upload a small headshot or slide file. Show the file immediately on record.
6. **2:15–2:40 — Communications.** Preview the session update, download its `.ics`, and click Send simulated. Point out the persisted delivery receipt.
7. **2:40–3:00 — Open-source/adoption close.** Show public embeds, the repository README, and Integrations. Mention the tested Airtable read/write proof and that D1 is the reliable fallback.

## Judge-Proof Claims

| Claim | Evidence |
| --- | --- |
| Open-source replacement | Public MIT repository, one-command local D1, one Worker architecture |
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
- [ ] Record video from a clean reset; submit with buffer.

## Known Intentional Limits

- D1 is the full backend. Airtable proves a read/write operational slice rather than mirroring every table.
- Email delivery is simulated and persisted; no external email is sent without credentials.
- Agenda supports drag-and-drop room scheduling plus day, track, room, and list projections; explicit room/time controls remain as the precise keyboard/mobile fallback.
- Speaker portal links use stable demo tokens; expiring production magic links are not claimed.
