# Live usability walk — Lectern, 2026-08-12 evening
Walker: Walt acting as a first-time judge, real browser, production.
Verdicts: PASS / FRICTION (works, but a judge would notice) / FAIL.

| # | Flow | Verdict | Notes |
|---|---|---|---|
| 1 | Landing page | FRICTION | Copy and CTAs strong. Logo mark still shows "S" (pre-rename initial) next to "Lectern". |
| 2 | Public event page: program explorer, search/filters, day tabs | PASS | Track/format/room filters, 5 sessions, clean layout. |
| 3 | Session detail from schedule row | PASS | Tags, full slot line, abstract, speaker chips; Back control. |
| 4 | Itinerary: save, reload persistence, export | PASS | "1 saved" after full reload (localStorage), Export .ics + Clear all present. |
| 5 | CFP: account create (name/email/password) | PASS | Signed-in banner, inline proposals dashboard, "At least 8 characters" hint. |
| 6 | Account -> form prefill | PASS | Name+email prefilled from the account. |
| 7 | Conditional field on Workshop | PASS | "Preferred workshop length*" appears only after selecting Workshop. |
| 8 | Proposal submit | PASS | "Proposal received", reference id, portal link offered. |
| 9 | Submitter portal (fresh speaker) | PASS | Identity, 0/0 metrics, profile editor, proposal "Awaiting first look" with Edit control. |
| 10 | Admin passcode gate | PASS | Enter submits; dashboard shows live numbers (11 submissions, 8 need decision) including the walk's submission. |
| 11 | Reviews: decision two-step | PASS | Custom answers surfaced (Prior speaking, Workshop length). Note + "Reviewing as" + honest template draft ("AI not configured — note saved to committee record, not copied into the email") + Deliver & approve. Queue 8 -> 7. |
| 12 | Agenda: conflicts + auto-place | PASS | Seeded room+speaker conflicts flagged prominently (the conflict engine demoing itself). Auto-place slotted the new workshop with receipt "auto-placed without adding room or speaker conflicts". Session card: content approval, history, move, edit, notify. |
| 13 | Schedule notice | PASS | Deep-link from agenda; session picker; draft carries exact slot facts (Wed Oct 14 · 9:00–9:45 AM PDT) + Download .ics; delivered to 1 speaker. |
| 14 | Outbox receipts | PASS | Confirmation (6:04 PM) and "You're speaking at…" notice (6:06 PM) both receipted with message ids. |
| 15 | Portal after acceptance | PASS | Proposal flips to Accepted; session appears (Oct 14, 9:00 AM · Workshop Studio); 4 onboarding tasks auto-assigned with due dates. The whole story closes for the speaker. |
| 16 | Reviewer portal + AI score draft | PASS | "Draft scores with AI" made a real bounded Haiku call (disclosed model, tokens logged); drafted 4/4/waitlist into editable selects; nothing saved until Submit; scorecard submitted -> 1 of 2 complete. |
| 17 | Roster | PASS | Walk speaker present with workflow status, session line with slot, task counter, portal link, edit record; Import CSV / Add speaker / status filter all present. |
| 18 | Files | PASS | Auto-assigned tasks listed with due dates + "Edit due date"; ZIP control present. Session badges correctly absent (no session-linked uploads in data). |
| 19 | Embeds | PASS | "Configure, save, preview, and retrieve" — five widget types, feeds, brand color, filters, field controls. |

## Product defects found: 1
- Logo mark showed "S" (pre-rename initial) on the landing and admin headers. Fixed during the walk; deployed with it.

## Frictions (would not block a judge)
- Saving a session to the itinerary lives in the itinerary block, not on the session detail itself.
- Intermittent blank screenshots came from the walk tooling's browser pane, not the app (page structure was always intact).

## Observations
- Reviewer AI drafting makes a real Haiku call in production (bounded, disclosed, token-logged). Deliberate post-closeout behavior; costs cents and reads honestly.
- Walk data (account, submission, acceptance, session, notice, scorecard) reseeded away after the walk; production restored to the pristine demo.
