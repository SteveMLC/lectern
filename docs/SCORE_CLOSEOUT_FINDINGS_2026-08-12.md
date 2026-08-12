# Score closeout findings — 2026-08-12

Source: the live full-fidelity run at `2026-08-12T18-34-25`, read while it was still completing. No additional paid evaluator run was started for this closeout.

## Genuine defects fixed

| Rubric | Defect | Closeout |
| --- | --- | --- |
| ABS-13 | Review CSV used a plain anchor, so organizer bearer auth was absent and the control returned 401. | Authenticated blob download with a visible success/error receipt. |
| ABS-14 | No AI-assisted numeric scoring surface existed. | Explicit Haiku-only score draft, fully editable, never auto-saved, one paid call per assignment per 15 minutes, provider usage logged. |
| CFP-06 | Custom-field answers were stored but difficult to find on the submissions surface. | Labeled answer block on desktop and mobile organizer submission views. |
| SPK-05 | Custom tasks were file requests only and their due date could not be edited. | General-action vs file-upload task types plus post-assignment due-date editing. |
| SPK-06 | Bulk mail left `{{portal_link}}` as literal text. | First-class portal invitation template with per-recipient speaker/event/portal token rendering. |
| SPK-11 | Agenda loaded only public speakers; direct-session links could not be repaired after creation. | Full organizer roster plus add/replace/remove direct-session speakers in Edit details. |
| CNT-04 | The organizer file library could label the wrong asset Latest and older versions were visually ambiguous. | Context-aware latest selection and explicit Latest/Previous download labels. |
| CNT-10 | A saved bio was line-clamped, so the persistence check was not legible. | Full saved bio shown on the roster card. |
| CNT-11 | Restore receipt named only the title, making restored abstract content hard to verify. | Receipt includes the restored abstract excerpt. |
| CNT-14 | ZIP generation had one implicit grouping mode and weak completion evidence. | By-speaker, by-session, and flat grouping with an explicit result receipt. |

## Working capabilities made easier to judge

- CNT-05 already had durable cross-role file threads with role, author, and timestamp.
- CNT-12 already enforced content approval in public SQL queries and showed explicit public-hidden/public-visible receipts.
- CNT-13 already aggregated speaker, session, date, version, and task metadata; the version labels now make that hierarchy unambiguous.
- AIA completed at 100% in the live run. No agenda rewrite was justified.

## Verification and spend posture

- `pnpm verify`: passed, including 225 tests, production build, usage-ledger integrity, evaluation-ledger integrity, and Cloudflare dry-run.
- No sbek/evaluator command was run in this branch.
- Reviewer score drafting uses `claude-haiku-4-5-20251001`, caps output at 350 tokens, requires an explicit click, never auto-saves, and writes provider-reported counters to `ai_usage_events`.
- The local historical usage ledger validates, but automatic session sync is not configured in this isolated worktree; it safely no-ops rather than guessing attribution.
