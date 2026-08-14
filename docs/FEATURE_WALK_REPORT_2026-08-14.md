# Lectern production feature walk — 2026-08-14

Live target: `https://lectern.lectern-go7.workers.dev`  
Release under test: main through `ac848ee`  
Final Worker version: `08a39594-a365-43b9-b8a9-f90055ed6536`

## Verdict

All six requested feature areas and the complete regression chain pass in production. The hostile walk found two real defects: empty choice lists could be persisted, and an automation-fast signed-in submit could race account restoration. Both were repaired, merged, deployed, and retested. No paid evaluation harness was run.

## 1. Portal Forms — PASS

- Built **Hostile walk complete profile** with text, textarea, select, checkbox, email, URL, and number fields; assigned it to Ada Okafor and Dana Whitfield.
- Dana's portal rendered all seven controls. Submission completed the task, persisted four non-empty answers, and reopening showed the saved response.
- Organizer results showed Dana's answers against Dana and reported `assigned: 2`, `completed: 1`, `responseCount: 1`.
- Required-field bypass returned `422` and named the missing **Preferred name** and **Meal choice** fields.
- Dana's capability token combined with Ada's task id returned `404 task_not_found`; no other speaker's data appeared.
- Duplicate keys, more than 30 fields, and a select with no options all return `422`.
- Re-submitting the same form updated Dana's response rather than adding a duplicate.

Defect found and closed: production initially accepted a select with `options: null`. PRs [#28](https://github.com/SteveMLC/lectern/pull/28) and [#29](https://github.com/SteveMLC/lectern/pull/29) added shared-contract and explicit API-boundary enforcement. The final production probe returned:

```json
{"status":422,"code":"validation_error","path":["fields",0,"options"],"message":"Choice-list fields require at least one option."}
```

## 2. Post-submission behavior — PASS

- Workshop selection revealed the required workshop-length field; a 90-minute workshop submitted successfully as `SUB-13`.
- The confirmation exposed an announced ten-second countdown and automatically navigated to the speaker portal.
- **Stay on this page** remained sticky after a 31-second wait.
- **Go now** navigated immediately to `/speaker/spk_rpzxdntaw9h8`.
- Signed-in **Submit another proposal** cleared the title and abstract, removed the draft query parameter, and retained read-only name/email.
- Anonymous **Submit another proposal** returned exactly `/e/horizon-2026/cfp` and cleared name, email, title, and abstract.

Defect found and closed: a deliberately delayed submitter-dashboard request reproduced a transient validation race on fast reload. The deployed guard now shows a disabled **Restoring account…** action until identity is loaded, then enables **Submit proposal** with the restored name/email.

## 3. Agenda Week and Conflicts — PASS

- Week showed one column for each event day, with sessions sorted by local start time and the day filter disabled.
- Conflicts grouped room and speaker overlaps with their time window.
- **Show on board** cleared active track/room filters, switched to the room board, and focused the session.
- Moving the two seeded collisions reduced the conflict count to zero and showed **Nothing clashes** rather than a blank view.
- A session at `2026-10-15T07:05:00Z` rendered under October 15 at 12:05 AM in `America/Los_Angeles`, proving the near-midnight boundary.
- The final reset restored the two intentional judging conflicts.

## 4. Submission reference codes — PASS

- Two concurrent production submissions returned unique `SUB-11` and `SUB-12` codes.
- The code appeared on the CFP confirmation, review cards, and the second `Reference` column in the CSV export.
- Additional UI submissions advanced monotonically through `SUB-17`; no collision or reuse occurred.

## 5. Calendar invitations — PASS

- Speaker invitation: HTTP `200`, calendar content type with `method=REQUEST`, `METHOD:REQUEST`, `ORGANIZER:mailto:lectern@qualora.io`, speaker-specific `ATTENDEE`, and a session-plus-speaker UID.
- Public session calendar: HTTP `200`, `METHOD:PUBLISH`, public session UID, and no organizer or attendee invitation semantics.
- Mail-client rendering was not exercised; it was an optional manual check, and the protocol-level distinction passed.

## 6. Speed — PASS

Production medians from `scripts/measure-latency.mjs`:

| Surface | Median |
| --- | ---: |
| Landing | 18 ms |
| Public event | 20 ms |
| Schedule API | 54 ms |
| Speakers API | 52 ms |
| Schedule embed | 52 ms |
| Agent handoff | 16 ms |

Slowest median: **54 ms**, comfortably below the 500 ms gate.

## Regression sweep — PASS

1. Public workshop proposal, conditional field, receipt, countdown, cancellation, immediate navigation, and both reset modes passed.
2. Review decision saved a named committee note, generated an editable deterministic acceptance draft, delivered it, and created one accepted session.
3. The accepted session auto-placed without new conflicts; agenda publish returned a visible success receipt.
4. Acceptance and schedule notices both appeared in Communications with persistent `sent_simulated` receipts.
5. Speaker portal reflected the accepted proposal, scheduled workshop, room/time, and four onboarding tasks.
6. Reviewer capability queue exposed only its two assignments. One bounded Haiku scoring assist produced editable scores and never auto-submitted; the submitted scorecard moved progress from 0/2 to 1/2.
7. Authorization probes: organizer endpoint without credentials returned `401`; with the public judge passcode returned `200`; an invalid speaker capability returned `404`.

`pnpm verify` passed with **34 test files and 256 tests**, plus typecheck, production build, Cloudflare dry run, the 86/86 requirements ledger, and the usage-ledger integrity gate.

## AI usage evidence

- The production counter feed retained 15 provider-reported events across the final reset.
- The walk's scoring-assist request was recorded by Anthropic request id with 843 input tokens, 181 output tokens, purpose `review_score_draft:round_final:sub_design_evals`, measurement `provider_reported`, and a SHA-256 evidence digest.
- Runtime storage and export contain counters only; prompts, reviewer notes, and generated content are excluded.
- `pnpm usage:runtime -- --d1 --check` confirmed all 15 D1 events are exported to the append-only repository ledger.
- Local source sync is configured for the Codex task, Fable/Opus build session, and Walt/OpenClaw coordination session. A second sync appended zero duplicate entries.
- Final ledger validation passed with one unique evidence record per entry and append-only receipt coverage. See `usage/REPORT.md` for the generated current counts and reimbursement summary.

## Final production state

The final controlled reset passed all 7 production checks. The pristine demo contains 10 submissions, 5 sessions, 8 speakers, the two intentional conflicts, and five generated headshots (Ada, Dana, Lin, Omar, Priya). Hostile-walk submissions, forms, accounts, decisions, and emails were removed. Runtime AI evidence was intentionally preserved.

## Remaining low-risk observations

- The production bundle emits a build-time chunk-size warning at 610 kB minified; runtime medians remain 54 ms or better.
- The speaker portal's same-origin schedule iframe causes Chromium's standard sandbox warning (`allow-scripts` plus `allow-same-origin`). The page had zero console errors and the embed worked. Treat this as a future hardening item, not a release blocker.
