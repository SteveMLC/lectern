# Evaluation gap ledger

Baseline: official sbek run `2026-08-12T00-14-16`. The run emitted 84 rubric rows: 46 received product verdicts and 38 could not be judged because the evaluator's capped Anthropic credit was exhausted. The source specifications contain **86 required items**; CFP-08 and SPK-16 were absent from the run output and are now explicitly tracked below. No sbek scenario was re-run during this work.

Status meanings: **FIXED** means implemented or an existing passing behavior was preserved and locally rechecked; **PARTIAL** states the remaining gap; **PARKED** records a deliberate scope/architecture decision. Production must apply `0003_review_workflows.sql` and `0004_round_scorecards.sql` before deploying this branch.

## One-minute verification routes

- **V1 — Speaker proposal lifecycle:** open an undecided speaker at `/speaker/:speakerId`; “Your proposals” shows status and Edit. Set CFP close in `/admin/settings` to the past and confirm the same editor locks. Decision notes never appear.
- **V2 — Organizer evaluations:** `/admin/evaluations`; create/edit two rounds, criteria/weights, blind mode, per-round reviewers/caps, exact assignments, auto-distribute, progress, nudge, score sort, and CSV export.
- **V3 — Reviewer scope:** use the `/review/:reviewerToken` link shown beside a reviewer; only assigned open-round proposals render. In blind mode no speaker identity is returned. Submit scores, reopen them, or Recuse.
- **V4 — CFP/event configuration:** `/admin/settings`; change dates, add a text/select/checkbox field (optionally conditional), add a track, or create an event. The public CFP and API enforce the same field/rule contract.
- **V5 — Outbox:** send a simulated reminder or schedule notice at `/admin/communications`, refresh “Sent messages,” and inspect recipient/status/time/message id.
- **V6 — Itinerary:** `/e/horizon-2026` or `/embed-preview`; star sessions, switch day tabs, reload, and clear all.
- **V7 — Agenda assist:** `/admin/agenda`; add a room or click “Auto-place unscheduled.” Placements use open 45-minute slots without introducing room/speaker overlaps.
- **V8 — File versions:** upload two files of one kind in a speaker portal, then inspect timestamps/Latest at the portal and `/admin/files`.
- **V9 — Co-presenters:** submit a public CFP with a co-presenter; the organizer submission/reviewer view shows both presenters and the co-speaker role, and acceptance carries both into the session.

## Abstract Management (14/14 logged)

| ID | Baseline | Judge reason (one line) | Decision / local verification |
| --- | --- | --- | --- |
| ABS-01 | NOT FOUND | No persisted review-round or evaluation-plan UI existed. | **FIXED** — independent named/date/status rounds with distinct scorecards; V2. |
| ABS-02 | NOT FOUND | No reviewer entity or round-scoped pool existed. | **FIXED** — `round_reviewers` is keyed per round and exposes capability links; V2/V3. |
| ABS-03 | NOT FOUND | No scorecard editor or numeric/dropdown/text storage existed. | **FIXED** — weighted numeric criteria plus built-in recommendation dropdown and comments persist; V2/V3. |
| ABS-04 | NOT FOUND | No criteria weights or weighted aggregate existed. | **FIXED** — pure tested weighted mean (4×2 + 2×1)/3 = 3.33 and organizer aggregates; V2. |
| ABS-05 | NOT FOUND | No assignments or reviewer-scoped queue existed. | **FIXED** — exact per-reviewer assignment rows and capability queue; V2/V3. |
| ABS-06 | NOT FOUND | No caps, filtering, bulk, or auto-distribution existed. | **FIXED** — per-reviewer caps plus round-robin auto-distribute of unassigned proposals; V2. |
| ABS-07 | NOT FOUND | Reviewer surfaces exposed speaker identity and had no blind setting. | **FIXED** — per-round blind mode omits speaker names, companies, bios, and emails at the API boundary; V2/V3. |
| ABS-08 | NOT FOUND | No per-reviewer completion dashboard existed. | **FIXED** — assigned/complete counts derive from assignments and non-recused reviews; V2/V3. |
| ABS-09 | NOT FOUND | No reviewer reminder control existed. | **FIXED** — lagging-reviewer Nudge records a simulated message receipt; V2/V5. |
| ABS-10 | NOT FOUND | No numeric aggregate column or sort existed. | **FIXED** — weighted results table toggles ascending/descending; V2. |
| ABS-11 | NOT FOUND | No co-presenter flow was reachable. | **FIXED** — public CFP accepts up to two co-presenters and preserves role links; V9. |
| ABS-12 | NOT FOUND | No conflict/recusal control existed. | **FIXED** — reviewer Recuse stores `abstain` and removes the item from the actionable queue; V3. |
| ABS-13 | PARTIAL | General submissions CSV existed, but it contained no review scores/aggregates. | **FIXED** — review-results CSV includes weighted aggregate, completion count, status, track, and id; V2. |
| ABS-14 | NOT FOUND | No AI evaluator, AI score, or override existed. | **PARKED** — deliberate product stance: SpeakerOps does not claim AI review; item is N/A under its pass criteria. |

## AI Agenda & Schedule Builder (8/8 logged)

The baseline reason for every AIA item was “judge call failed because the evaluator credit balance was exhausted,” so these are implementation audits rather than changed product verdicts.

| ID | Baseline | Judge reason (one line) | Decision / local verification |
| --- | --- | --- | --- |
| AIA-01 | CANNOT JUDGE | Evaluator credit exhausted before agenda judging. | **FIXED (preserved)** — multi-day room board/list, day/track/room filters remain; V7. |
| AIA-02 | CANNOT JUDGE | Evaluator credit exhausted before room/track judging. | **FIXED** — add track in Settings and room on Agenda; both immediately enter selectors; V4/V7. |
| AIA-03 | CANNOT JUDGE | Evaluator credit exhausted before placement judging. | **FIXED (preserved)** — drag and exact day/time/room placement persist; V7. |
| AIA-04 | CANNOT JUDGE | Evaluator credit exhausted before speaker-conflict judging. | **FIXED (preserved)** — visible speaker-overlap conflict engine remains load-bearing; V7. |
| AIA-05 | CANNOT JUDGE | Evaluator credit exhausted before room-conflict judging. | **FIXED (preserved)** — room overlaps remain visibly flagged; V7. |
| AIA-06 | CANNOT JUDGE | Evaluator credit exhausted before move/conflict-clear judging. | **FIXED (preserved)** — move/drag recomputes and clears conflicts; V7. |
| AIA-07 | CANNOT JUDGE | Evaluator credit exhausted before publish judging. | **PARTIAL** — every confirmed placement is immediately public, but there is no explicit publish/go-live button. |
| AIA-08 | CANNOT JUDGE | Evaluator credit exhausted before assisted scheduling judging. | **FIXED** — one-action conflict-aware “Auto-place unscheduled”; V7. |

## Call for Papers (18/18 logged)

| ID | Baseline | Judge reason (one line) | Decision / local verification |
| --- | --- | --- | --- |
| CFP-01 | NOT FOUND | No organizer form builder or track/field configuration existed. | **FIXED** — honest text/select/checkbox builder, required flag, conditional rule, and track creation; V4. |
| CFP-02 | PASS | Seeded Workshop conditional field showed/hid and validated bidirectionally. | **FIXED (preserved)** — shared rules engine remains; V4. |
| CFP-03 | PASS | Logged-out public CFP showed event, deadline, tracks, formats, and form. | **FIXED (preserved)** — public route unchanged except new configured fields. |
| CFP-04 | NOT FOUND | CFP close date was read-only and no PATCH/settings route existed. | **FIXED** — `/admin/settings` and organizer PATCH update open/close state; V4. |
| CFP-05 | PARTIAL | Submission worked, but the speaker portal did not list proposals/status. | **FIXED** — speaker-safe “Your proposals” with status and reference; V1. |
| CFP-06 | PASS | Submitted proposal data round-tripped intact to organizers. | **FIXED (preserved)** — shared contracts and validation retained. |
| CFP-07 | NOT FOUND | No save-draft or resume-later path existed. | **PARKED** — durable anonymous draft recovery needs a separate token lifecycle; avoided a half-secured implementation. |
| CFP-08 | OMITTED BY RUN | Source rubric requires automatic submission confirmation in email or the in-app outbox. | **FIXED** — each successful proposal now records a simulated confirmation with recipient, event, and proposal title in the durable outbox. |
| CFP-09 | NOT FOUND | No proposal editing surface or PATCH route existed. | **FIXED** — capability-scoped title/abstract/answer editing; V1. |
| CFP-10 | NOT FOUND | No reviewer provisioning or reviewer-scoped dashboard existed. | **FIXED** — per-round reviewer pool and capability queue; V2/V3. |
| CFP-11 | PARTIAL | Named notes persisted, but there was no numeric scorecard/reviewer completion. | **FIXED** — stored criteria, recommendation, comments, and completion; V2/V3. |
| CFP-12 | PASS | Accepted/waitlisted/denied decisions persisted distinctly. | **FIXED (preserved)** — DecisionControls was not changed. |
| CFP-13 | NOT FOUND | Speakers had no surface showing their decision. | **FIXED** — Accepted/Waitlisted/Denied badges are visible without internal reasoning; V1. |
| CFP-14 | PARTIAL | Decision drafts/simulated send worked, but no persistent outbox existed. | **FIXED** — sent-message table with receipt fields; V5. |
| CFP-15 | PARTIAL | Acceptance created a session, though evaluator evidence missed the rendered agenda row. | **FIXED (preserved)** — idempotent acceptance/session lineage and agenda remained green. |
| CFP-16 | NOT FOUND | Neither editable speaker proposals nor configurable close-state locking existed. | **FIXED** — shared injected-clock policy plus server recheck locks on close/decision; V1/V4. |
| CFP-17 | PARTIAL | Multi-event switcher existed, but events could not be created. | **FIXED** — organizer creates an isolated event with CFP and evaluation plan; V4. |
| CFP-18 | PASS | Event switcher showed scoped counts/data without leakage. | **FIXED (preserved)** — all new configuration writes require the active event id. |

## Content Management & Speaker Deliverables (14/14 logged)

The baseline reason for every CNT item was “judge call failed because the evaluator credit balance was exhausted.”

| ID | Baseline | Judge reason (one line) | Decision / local verification |
| --- | --- | --- | --- |
| CNT-01 | CANNOT JUDGE | Evaluator credit exhausted before file-request judging. | **PARKED** — organizer-authored task definitions/assignment UI remains a separate workflow. |
| CNT-02 | CANNOT JUDGE | Evaluator credit exhausted before portal upload judging. | **PARTIAL** — portal tasks/deadlines and R2 upload work, but an upload is not linked to a specific task/session. |
| CNT-03 | CANNOT JUDGE | Evaluator credit exhausted before speaker scoping judging. | **FIXED (preserved)** — speaker capability returns only that speaker's sessions/tasks/files; organizer routes remain passcode-gated. |
| CNT-04 | CANNOT JUDGE | Evaluator credit exhausted before version judging. | **FIXED** — all versions remain downloadable with timestamp and per-kind Latest marker; V8. |
| CNT-05 | CANNOT JUDGE | Evaluator credit exhausted before file-comment judging. | **PARKED** — no file-comment schema/thread was added; versioning carried higher value and lower risk. |
| CNT-06 | CANNOT JUDGE | Evaluator credit exhausted before upload-constraint judging. | **FIXED (preserved)** — uploader states headshot/slides/document and 10 MB limit; server enforces it. |
| CNT-07 | CANNOT JUDGE | Evaluator credit exhausted before deliverables-dashboard judging. | **PARTIAL** — central files view exists, but no task-status filter/dashboard; V8. |
| CNT-08 | CANNOT JUDGE | Evaluator credit exhausted before bulk-reminder judging. | **PARTIAL** — single-speaker reminders and receipts exist; speaker bulk selection remains absent. |
| CNT-09 | CANNOT JUDGE | Evaluator credit exhausted before session-edit judging. | **FIXED (preserved)** — Agenda “Edit details” persists title/abstract. |
| CNT-10 | CANNOT JUDGE | Evaluator credit exhausted before organizer speaker-edit judging. | **FIXED (preserved)** — roster opens the profile/files surface and changes persist. |
| CNT-11 | CANNOT JUDGE | Evaluator credit exhausted before content-history judging. | **PARKED** — file history exists, but editable text version/restore history was not added. |
| CNT-12 | CANNOT JUDGE | Evaluator credit exhausted before approval-gate judging. | **PARKED** — confirmed session status remains the publication gate; no separate content-approval state. |
| CNT-13 | CANNOT JUDGE | Evaluator credit exhausted before central-library judging. | **FIXED** — `/admin/files` aggregates speaker uploads with owner/date/version/latest metadata; V8. |
| CNT-14 | CANNOT JUDGE | Evaluator credit exhausted before bulk-download judging. | **PARKED** — ZIP generation/storage was not justified within the dependency and risk fences. |

## Public & Embeddable Widgets (16/16 logged)

The baseline reason for every EMB item was “judge call failed because the evaluator credit balance was exhausted.”

| ID | Baseline | Judge reason (one line) | Decision / local verification |
| --- | --- | --- | --- |
| EMB-01 | CANNOT JUDGE | Evaluator credit exhausted before sessions-widget judging. | **FIXED** — populated cards include title, description expansion, scheduled date/time and room, speaker job metadata, Format, and Track. |
| EMB-02 | CANNOT JUDGE | Evaluator credit exhausted before session-search judging. | **FIXED** — public sessions embed searches title and speaker identity metadata with a live result count. |
| EMB-03 | CANNOT JUDGE | Evaluator credit exhausted before facet judging. | **FIXED** — working Track, Format, and Room facets narrow the public sessions embed. |
| EMB-04 | CANNOT JUDGE | Evaluator credit exhausted before speaker-directory judging. | **FIXED** — headshot/name/title/company render with graceful initials and deterministic surname ordering. |
| EMB-05 | CANNOT JUDGE | Evaluator credit exhausted before speaker-detail judging. | **FIXED** — searchable speaker directory expands each entry into bio and scheduled sessions with date/time/room. |
| EMB-06 | CANNOT JUDGE | Evaluator credit exhausted before public-agenda judging. | **FIXED (preserved)** — schedule is grouped by day/time with room, title, track, and speakers. |
| EMB-07 | CANNOT JUDGE | Evaluator credit exhausted before agenda-day navigation judging. | **FIXED** — public agenda day tabs change both the selected day label and rendered session set; seed data includes populated sessions on both event days. |
| EMB-08 | CANNOT JUDGE | Evaluator credit exhausted before agenda-detail judging. | **FIXED** — each agenda block expands in place to full range, room, description, Format, Track, and speakers, and collapses back to the agenda. |
| EMB-09 | CANNOT JUDGE | Evaluator credit exhausted before itinerary-content judging. | **FIXED** — chronological day tabs plus track, format, title, description, time, room, and complete speaker job metadata. |
| EMB-10 | CANNOT JUDGE | Evaluator credit exhausted before personal-schedule judging. | **FIXED** — anonymous star/save produces exactly the selected browser-local itinerary; V6. |
| EMB-11 | CANNOT JUDGE | Evaluator credit exhausted before itinerary persistence/export judging. | **FIXED** — browser-local selection persists across reload and exports the exact chosen sessions as one multi-event `.ics`. |
| EMB-12 | CANNOT JUDGE | Evaluator credit exhausted before gallery judging. | **FIXED** — distinct searchable photo grid with initials fallback, job metadata, and surname sorting. |
| EMB-13 | CANNOT JUDGE | Evaluator credit exhausted before gallery-detail judging. | **FIXED** — each gallery card expands to photo/profile/bio and scheduled-session details, then collapses to the intact grid. |
| EMB-14 | CANNOT JUDGE | Evaluator credit exhausted before distribution judging. | **FIXED** — all five widget surfaces are anonymous, populated iframe endpoints: sessions, speakers, agenda, itinerary, and gallery. |
| EMB-15 | CANNOT JUDGE | Evaluator credit exhausted before embed-generator judging. | **PARTIAL** — retrievable snippets/feed URLs exist in API docs/preview; no saved/configurable embed builder. |
| EMB-16 | CANNOT JUDGE | Evaluator credit exhausted before consistency judging. | **FIXED (preserved)** — all public surfaces read the same schedule/session/speaker endpoints immediately. |

## Speaker Management (16/16 logged)

| ID | Baseline | Judge reason (one line) | Decision / local verification |
| --- | --- | --- | --- |
| SPK-01 | PARTIAL | Roster showed identity/bio, but had no speaker search/filter. | **FIXED** — admin roster searches name, title, and company with a live result count and deterministic filter tests. |
| SPK-02 | PARTIAL | Speaker creation only happened through CFP; no organizer add-speaker flow. | **PARKED** — direct speaker creation requires invitation/capability issuance semantics. |
| SPK-03 | NOT FOUND | No inbound CSV speaker import existed. | **PARKED** — import validation/deduplication was lower-ranked than review and CFP work. |
| SPK-04 | NOT FOUND | No speaker-level workflow status/filter existed. | **PARKED** — proposal/task/session states remain authoritative; no duplicate speaker status added. |
| SPK-05 | NOT FOUND | Tasks were seeded, with no organizer create/edit/assign UI. | **PARKED** — same remaining gap as CNT-01. |
| SPK-06 | PASS | Per-speaker onboarding template and simulated-send control worked. | **FIXED (preserved)** — outbox now makes the receipt durable; V5. |
| SPK-07 | PASS | Capability portal was speaker-facing and scoped to the linked speaker. | **FIXED (preserved)** — proposals were added without organizer reviews/reasoning. |
| SPK-08 | PASS | Profile/headshot edits persisted into organizer/public surfaces. | **FIXED (preserved)** — upload/profile seams unchanged. |
| SPK-09 | PASS | Task status/due dates and completion persisted across reload. | **FIXED (preserved)** — task update path unchanged. |
| SPK-10 | PARTIAL | Organizer could download files, but timestamps/uploader/latest identity were missing. | **FIXED** — timestamps and per-kind Latest markers in portal and central organizer files; V8. |
| SPK-11 | PASS | Session-speaker link appeared organizer-side and speaker-side. | **FIXED (preserved)** — co-presenters now follow the same acceptance lineage; V9. |
| SPK-12 | NOT FOUND | Roster had no aggregate task progress/filter. | **FIXED** — every roster card shows completed/total tasks and a progress bar; organizer can filter incomplete, complete, or unassigned speakers. |
| SPK-13 | PARTIAL | Send succeeded, but recipient selection and communications history were incomplete. | **PARTIAL** — history/outbox is fixed; multi-select/all-speaker broadcast remains absent; V5. |
| SPK-14 | PASS | Templates resolved recipient-specific names, tasks, portal URLs, and slot facts. | **FIXED (preserved)** — drafting/template logic unchanged. |
| SPK-15 | PARTIAL | Speaker profiles lacked logistics/custom fields; only submission travel support existed. | **PARKED** — CFP custom fields were added, not a second speaker-profile custom-field system. |
| SPK-16 | OMITTED BY RUN | Source rubric requires automatic due-date reminders without an organizer manually sending. | **PARTIAL** — a six-hour scheduled trigger records idempotent reminders for incomplete tasks due within 48 hours or overdue, including task and due date in the outbox; actual inbox delivery still requires the Resend transport to be wired and proven. |

## Zero-spend verification policy

- `pnpm verify` is the default and performs no paid model calls. It now fails if any of the 86 required rubric IDs disappears from this ledger.
- Runtime drafting stays deterministic unless `AI_RUNTIME_MODE=enabled`; an API key by itself cannot spend money.
- `pnpm eval:paid` fails closed unless one scenario, at most 20 turns, an explicit approval phrase, a non-sensitive approval ticket, and an approved ceiling of at most $2 are all supplied. The ceiling is an authorization record, not provider-side enforcement; the operator must still watch provider billing.
- The official evaluator is not a completeness oracle: its incomplete 84-row output is why the repository now verifies against the 86-item source manifest.

## Ranked stretch not represented in the completed run

- **Speaker CRM (optional extra-credit suite): PARKED.** Cross-event roster/history would require a deliberate person-identity model across event-scoped speaker rows. The current `(event_id, email)` boundary prevents accidental cross-event leakage; changing it overnight would put the already-passing CFP, portal, and Airtable scopes at risk.
