# Self-judge run — 2026-08-11

The organizer published the judging method for this hackathon: an "llm as
judge smoke test for killmysaas competitors to validate user flows"
(forge.smol.ai/swyx/killmysaas-evals). Before submitting, we ran that exact
method against ourselves: a cold Claude agent with **no insider knowledge and
no credentials** was given only the live URL and the public repo, and told to
find its own way in, execute both personas' flows for real, probe the API,
and score the entry hostilely.

The report below is reproduced verbatim, warts included. Fixes shipped in
response are listed at the end.

---

# KILL MY SAAS — JUDGE REPORT: SpeakerOps

Entry: https://speakerops.speakerops-go7.workers.dev · https://github.com/SteveMLC/speakerops
Method: cold landing in a fresh browser tab, both personas executed end to end, plus API probes with curl. Everything below is what I personally saw or received; quotes are verbatim on-screen or wire text.

---

## ACCESS

Breadcrumb chain, exactly as followed:
1. Landed on `/` — homepage nav already shows "Demo event, API docs, Embeds, Organizer console" and a "Submit a talk to the demo event" button.
2. One scroll to the footer: "Judging or evaluating this deployment (human or agent)? /llms.txt has the full walkable chain, the demo passcode, and the API index — no account needed anywhere."
3. `/llms.txt` delivered everything in one file: the organizer passcode `speakerops-judge-2026` ("deliberately public for judging"), the CFP URL, a sample speaker portal, embeds, `/api/docs`, and a numbered 7-step judging chain. The `/admin` gate itself repeats the hint ("The passcode is published in /llms.txt and the README — it is public on purpose"), and the README carries the same passcode with an explanation that it differs from the local-dev default.

**3 page loads to full access; first meaningful action (typing a CFP proposal) at step 4, roughly 2 minutes in.** I was never stuck for access anywhere. This is the most agent-legible entry design I can imagine: every action returned a textual receipt, and that llms.txt promise ("actions return textual receipts") held up in practice.

## FLOWS

| # | Flow | Verdict | Observed evidence |
|---|------|---------|-------------------|
| 1 | CFP form loads (speaker) | PASS | "Call for Speakers — Horizon Dev Summit 2026", fields with real labels and placeholders |
| 2 | Conditional field on Workshop format | PASS | "Preferred workshop length *" appeared with helper "Required for workshops; hidden for other formats." |
| 3 | Conditional field enforced client-side | PASS | Submitted with it empty: red "Required." under the field, submit blocked |
| 4 | CFP submit | PASS | "Proposal received … Reference: sub_s80s9fz7mk48" + "Open speaker portal" link |
| 5 | Speaker portal auto-created pre-decision | PASS | `/speaker/spk_6fr6brvkc1w7`: "Judge Runner", tasks 0/0, "No confirmed sessions yet" |
| 6 | Organizer console unlock via published passcode | PASS | Dashboard: "Submissions 11", "8 need decision", pipeline bars, event settings |
| 7 | My proposal in Reviews with custom answers | PASS | Speaker card with bio + chips "Prior speaking: 1-5 talks", "Workshop length: 90 minutes" |
| 8 | Approve with written reasoning → AI acceptance email | PASS | Badge "Drafted by claude-sonnet-5 from your notes"; body carried my exact portal URL and the 4-item onboarding checklist; honest "We don't have day, time, or room details locked yet" |
| 9 | Approve receipt + session lineage | PASS | Banner: "'Judging the Judges…' is accepted and now lives in the program." Queue 8→7; session appeared in Agenda Unscheduled |
| 10 | Deny with written reasoning → AI feedback email | PASS | My blunt note ("first-time speaker plus travel support pushes it below the line") became kind, specific feedback and did NOT leak the bias; "Send (simulated) & deny" |
| 11 | Deny receipt | PASS | "'Cutting LLM Cost 10x Without Losing Quality' moved to Denied." Queue 7→6 |
| 12 | Pre-staged conflict detection | PASS | Red banner "2 live schedule conflicts" naming room overlap and "Ada Okafor is booked for … at the same time" |
| 13 | Drag-and-drop scheduling | PASS (first try), one silent miss later | "'Judging the Judges…' moved by drag-and-drop. Conflicts recalculated immediately." Second drag did nothing, no error shown |
| 14 | Live conflict recompute on my own move | PASS | Moving my talk into Main Hall 9:00: banner went to "3 live schedule conflicts" naming my session vs the Keynote; moving out returned it to 2 |
| 15 | Exact move controls (room + datetime) | PASS | Set Workshop Studio 10:00–11:30; card updated "Oct 14 · 10:00 AM–11:30 AM" |
| 16 | Schedule notice to speaker | PASS | Deep-linked with session preselected; "Slot (guaranteed in the email): Wednesday, October 14 · 10:00 AM – 11:30 AM PDT"; draft body matched slot exactly and wove in my note; "Recorded 1 simulated delivery — Judge Runner now knows their slot." |
| 17 | Reminder template + simulated send | PASS | Preview with derived checklist ("2 pending"); "Simulated delivery recorded at Aug 11, 10:38 AM · msg_xbjzw7sjvx4q" |
| 18 | Speaker portal after accept + schedule | PASS | Sessions 1: "Workshop · Oct 14, 10:00 AM · Workshop Studio"; 4 derived tasks matching the acceptance email checklist |
| 19 | Task completion | PASS | "Confirm speaker bio" flipped to "Complete", counter 1/4, "Mark pending" undo offered |
| 20 | File upload (R2) | PASS via API | POST portal assets → HTTP 201 with `r2Key: speakers/spk_6fr6brvkc1w7/…/judge-runner-headshot.png`; file then listed in portal UI "Files on record"; streams back 200 image/png with etag. (UI file-picker untested — judge-side tooling broke) |
| 21 | Direct sponsor session | PASS | Created with "Direct" chip and "Speaker TBA"; placed Panel Loft Oct 15; "Everything is placed" |
| 22 | Integrations page | PASS | "Connected", "MIRROR TABLES 8/8 ready", "MIRRORED RECORDS 61", "Last run: success · sync_keavaba4dbak" |
| 23 | Embeds preview | PASS | Three iframes with src paths shown; my session and speaker card present in each |
| 24 | Public event page + schedule JSON | PASS | My session public with `"origin": "accepted_submission"`, correct UTC times (17:00–18:30Z = 10:00–11:30 PDT) |
| 25 | API docs + health | PASS | JSON index of ~30 endpoints with 3 auth scopes; health `{"dataBackend":"d1","checks":{"db":true,"r2Bound":true}}` |
| 26 | API-side conditional validation | PASS | 422: `"Missing required field(s): Preferred workshop length."` with issue path `answers.workshop_length` — same rule as the browser |
| 27 | .ics calendar | PASS | 200 `text/calendar`, valid RFC 5545 VEVENT, DTSTART/DTEND correct, `LOCATION:Workshop Studio` |
| 28 | CSV export | PASS | My row "accepted" with note "Organizer (accept): Strong fit…"; Lin Zhao "rejected" with my note persisted |
| 29 | Airtable sync | PASS | HTTP 200 ledger: "created":8, "updated":53, 23 requests, per-table lines matching exactly what I created this session; runId matches the Integrations UI |
| 30 | Rubric scoring across named rounds (homepage claim) | NOT VERIFIED | Seeded cards show named committee notes with recommendations, but I found no UI to add a scored/rubric review or manage rounds; the only decision surface is Approve/Maybe/Deny + note |
| 31 | Real email delivery | NOT VERIFIABLE | By design: "Simulated outbox by default, real sending behind a key" — I could not verify actual transport |
| 32 | /demo second conference + reset | SKIPPED | Reset operation; out of scope for a judge run (the event switcher confirms "Groundwork 2026" exists) |

## JOB-TO-BE-DONE SCORE: 8/10

Could the AI Engineer conference team run their program on this next week? Mostly yes, and I say that having personally pushed one proposal through the entire spine: submit → review with reasoning → accept → session created → dragged/placed on the agenda → conflict checked → speaker notified with guaranteed slot facts → portal tasks + upload → public schedule, embeds, .ics, CSV, and Airtable mirror. Every link in that chain worked and left a receipt. The failure modes a program team fears (decision made but no session, schedule moved but speaker told the old time, hidden required fields the API demands anyway) each have an explicit design answer that I tested.

What they would still need:
- **Real email transport, proven.** Everything is simulated by default; "real sending behind a key" is a claim I could not check. A conference lives or dies on delivery.
- **Multi-reviewer machinery.** One shared passcode, no reviewer identity: my notes logged as "Organizer". Seeded data shows named reviewers with recommendations, but I found no way to add one, score a rubric, or run rounds — the homepage promises "Rubric scoring across named rounds" and the deployment does not demonstrably show it. Sessionboard's review committees need this.
- **Scale unknowns.** 11 submissions render as cards on one page; a real CFP is 300+. Pagination, search, and bulk decisions untested/absent.
- **An outbox view.** Sends leave banner receipts and message ids but I found no page listing sent messages.

## BONUS CRITERIA — what I personally verified

- **Cloudflare: VERIFIED.** Served from `workers.dev`, responses carry `server: cloudflare` and `cf-ray` headers, and `/api/health` reports live D1 and R2 bindings (`"dataBackend":"d1"`, `"r2Bound":true`). README describes one Worker + D1 + R2, consistent with behavior.
- **Airtable: VERIFIED as live, with one caveat.** `POST /api/airtable/events/horizon-2026/sync` (organizer passcode) returned a detailed ledger — "Speakers: 1 created … Submissions: 1 created … Sessions: 1 created … Tasks: 4 created" — exactly matching the entities I had just created, in 23 Airtable requests, runId `sync_keavaba4dbak`, which the Integrations UI then displayed as "Last run: success". Status endpoint shows `connected:true` with rate guard (210ms + Retry-After) and D1 fallback. Caveat: I cannot see inside the organizer's actual base, and the status flag `"active": false` is unexplained.
- **Useful API: VERIFIED.** `/api/docs` is a real JSON index (~30 endpoints, public/organizer/speaker-link auth scopes). I drove real work through it: schedule JSON, 422 validation with field paths, multipart upload to R2 (201 + key), asset streaming, .ics, CSV export, Airtable sync. Gap: the Airtable sync endpoint llms.txt advertises is missing from `/api/docs`.
- **Decision emails with feedback: VERIFIED for content, simulated for transport.** Acceptance draft (badge "Drafted by claude-sonnet-5 from your notes") carried the correct portal URL, the 4-item onboarding checklist, and my reasoning, and honestly declined to invent slot facts. Rejection draft turned a blunt internal note into kind, specific, actionable feedback without leaking the harsh parts. Nothing auto-sends; both sends produced receipts.

## STUCK POINTS

1. **Admin unlock, ~5 wasted steps (judge-side environment, not the product):** a browser-extension popup after entering the passcode blocked clicks/screenshots. Re-navigating to /admin cleared it.
2. **Enter did not submit the passcode form;** clicking Unlock was required.
3. **A drag that misses its drop target does nothing silently** — no toast, no error. The Move button (documented as the fallback) rescued it.
4. **Judge-side file_upload tooling was broken.** The product's own legibility saved the flow: `/api/docs` lists `POST /speaker-portal/:token/assets`, so R2 upload was verified by API and the file appeared in the portal UI.
5. **No outbox page found** for sent-message history; receipts are banners plus a message id.
6. **Small warts:** acceptance greeting "Hi Judge," (naive first-name split of "Judge Runner"); auto-slot gave a 90-minute workshop a 45-minute slot despite the "Workshop length: 90 minutes" answer (fixed via exact controls); the portal Speaker Guide embeds a literal example.com "Example Domain" frame; Airtable `active:false` vs "mirror is LIVE" wording.

## TOP 3 IMPROVEMENTS

1. **Ship the review committee it advertises:** reviewer identities, rubric scores, and named rounds in the UI — or cut the homepage claim. This is the biggest gap between promise and what a judge can see, and the feature Sessionboard buyers actually pay for.
2. **Prove real delivery:** a demo mode that sends one real email plus an outbox page listing every message with status, so "communications" is verifiable end to end rather than simulated.
3. **Close the small receipt gaps:** toast on failed/missed drag drops, honor the workshop-length answer when auto-slotting, auto-complete the "Upload headshot" task when a headshot upload lands, and add the Airtable sync endpoint to /api/docs.

**Bottom line:** this entry does the job it claims, is honest about what it does not do, and is built so an agent judge can prove both. The chain from CFP to published, conflict-checked, Airtable-mirrored agenda ran clean on the first pass. What stands between it and "cancel Sessionboard next week" is the multi-reviewer layer and proven email transport, not the program spine.

---

## Fixes shipped in response (same day)

- Homepage review card no longer claims rubric rounds; it now describes what
  the deployment demonstrably does (decisions + committee notes + reviewed AI
  decision emails).
- Enter now explicitly submits the organizer passcode form — agent drivers
  synthesize key events that skip implicit form submission.
- The stale legacy `/api/integrations/airtable/status` route (source of the
  unexplained `active:false`) was removed; `/api/docs` now lists the real
  mirror routes (`/api/airtable/status`, `/api/airtable/events/:slug/sync`)
  plus `/api/admin/ping` and `/api/admin/ai-usage`.
- The seeded example.com placeholders (event website, Speaker Guide iframe,
  reminder body) were replaced with real destinations.
- Known and accepted for the deadline, documented rather than patched:
  silent missed-drag (Move controls are the fallback), 45-minute default
  auto-slot regardless of workshop length (exact controls fix it), no outbox
  page (receipts + message ids only), single-reviewer identity, simulated
  transport.
