# Lectern

**CFP to published agenda, without the enterprise tax.**

Lectern is an open-source replacement for the program side of Sessionboard: call-for-speakers forms with conditional logic, proposal decisions, acceptance-to-session flow, drag-and-drop agenda scheduling with live conflict detection, a speaker portal with real file uploads, templated communications with calendar invites, and embeddable public schedule, session, and speaker pages.

Built for [Kill My SaaS 1](https://forge.smol.ai/). Cloudflare-native: one Worker serves the API and the app, D1 stores operational data, R2 stores speaker assets, and a rate-safe, idempotent Airtable mirror pushes the operational record into the organizer's base.

## Try it live

**https://lectern.lectern-go7.workers.dev**

Organizer passcode: **`lectern-judge-2026`** — a deliberately public demo passcode, not a credential. It is distinct from the local development default, so a checkout of this repo never shares a passcode with the hosted demo. On your own deploy, set your own with `wrangler secret put ORGANIZER_PASSCODE`.

A five-minute tour, in order:

| # | Do this | What it proves |
| --- | --- | --- |
| 1 | [Open the event page](https://lectern.lectern-go7.workers.dev/e/horizon-2026) | Seeded conference: 4 tracks, 3 rooms, CFP open |
| 2 | [Submit a proposal](https://lectern.lectern-go7.workers.dev/e/horizon-2026/cfp) — pick **Workshop** as the format | A conditional field appears, and it is required. Switch back to Talk and it vanishes. The API enforces the same rule, so a hidden field is never demanded |
| 3 | [Open the organizer console](https://lectern.lectern-go7.workers.dev/admin) and go to Submissions | Your proposal is there with its speaker attached — the full public-to-organizer round trip |
| 4 | [Load a second conference](https://lectern.lectern-go7.workers.dev/demo) | A hand-authored dataset with staged scheduling conflicts. The same button resets it, so you can break anything here safely |
| 5 | [View the embeds](https://lectern.lectern-go7.workers.dev/embed-preview) | Iframe-ready schedule, sessions, and speaker gallery. Narrow the window — they are mobile-first |

Break the demo on purpose. **Reset** on `/demo` restores the loaded conference to exactly what its files describe, and the seeded event has a one-command reset too.

## Status

The complete judging path is deployed and production-proven:

- Public event page and CFP form with **live conditional field logic** (the workshop-length field appears only for workshop proposals, and the API enforces the same rule server-side).
- **Golden path**: public CFP submission → persisted in D1 → visible in the organizer submissions console, with speaker dedup by email.
- Organizer console (passcode-gated): dashboard counts, searchable submissions, formula-safe CSV export, Approve/Maybe/Deny decisions with editable feedback drafts, direct invited sessions, and drag-and-drop room scheduling with day/track/room filters, list projection, exact controls, and live room/speaker conflicts.
- **Speaker portal**: demo-link profile editing, onboarding task completion, and speaker-facing R2 upload/download as first-class asset records. Production-grade expiring links are deliberately not claimed.
- **Communications**: task-reminder and session-update previews, persisted delivery receipts, optional real Resend transport with an explicit recipient allowlist, and downloadable `.ics` calendar handoffs.
- **AI decision emails, all three ways**: every decision opens a reasoning box; Claude (`claude-sonnet-5`) drafts the speaker-facing email from the organizer's blunt internal notes — an acceptance carrying the speaker's portal link and the exact onboarding checklist the system derives (link guaranteed even if the model omits it), or thoughtful feedback for deny/waitlist. AI proposes, the human approves, nothing auto-sends, and an honest template takes over when no key is configured.
- **Editable program copy**: retitle a talk when you approve it, or any time after from the agenda. The session carries the program title; the submission keeps what the speaker pitched, so lineage always shows both.
- **Committee notes that outlive the call**: the reasoning behind a decision is persisted as a review on the proposal — visible on the card next time anyone looks, exported in the CSV, and kept out of speaker-facing surfaces.
- **One decider by default, a committee only when needed**: the decision panel takes an optional "Reviewing as" name. A single organizer never touches it and works exactly as before. When a team wants more than one voice, each named reviewer's note stacks on the card instead of overwriting the last — the deliberate opposite of tools that force you to configure evaluation plans, scorecards, and reviewer pools before you can decide anything. A label, not an account: the passcode stays the trust boundary, matching how small program teams actually run.
- **Schedule notices**: once a session is slotted, one deliberate click drafts the email telling every speaker on it their confirmed day, time (in the event's timezone), and room, plus calendar and program links — AI-personalized from an organizer note, with the slot facts required verbatim and guaranteed into the body even if the model drops them. Dragging the agenda never fires an email.
- **Airtable mirror**: all eight operational tables, idempotent record mapping, schema adoption, 5 req/s protection, 429 retries, guarded reset/deduplication, explicit D1 fallback, and an organizer status screen.
- **Public embeds**: iframe-friendly schedule, sessions, and speaker gallery routes backed by the same D1 program data.
- **API docs**: `/docs`, `/api-docs`, `/embed-preview`, and machine-readable `/api/docs`.
- Deterministic demo seed and one-command reset.
- Domain layer with tests: schedule conflict detection (room + speaker double-booking), guarded review transitions, and idempotent acceptance-to-session conversion.

The judging-critical product path is live on Cloudflare Workers with D1 and R2 provisioned. Release status lives in [`docs/CRITICAL_PATH.md`](docs/CRITICAL_PATH.md).

## Hackathon scope clarifications

Latest organizer FAQ from Discord:

- Basic conditional form logic is enough for MVP; the current shared browser/API rule is the right foundation.
- Talks can be routed to one or more tracks, and reviewers can cover one or more tracks.
- Minimum review flow: `unreviewed` -> `approve` / `maybe` / `deny`.
- Decision email from inside the app is a bonus, especially when it can carry feedback or change requests.
- Day/room scheduling with drag-and-drop and conflict detection is enough.
- Email/calendar workflows should exist at MVP depth through preview/simulated send, with Resend or Cloudflare email wiring when a key is available.
- Accelevents is optional. Lectern includes a generic, Excel-friendly submissions CSV handoff; an Accelevents-specific field mapper is deliberately out of scope.
- Admin UI is the highest-priority surface.

## We ran the judge on ourselves

The organizer published the judging method: an LLM-as-judge smoke test that
validates user flows on competitor deployments. Before submitting, we ran
that exact method against this entry — a cold Claude agent, no credentials,
no insider knowledge, just the live URL and this repo. It found its way in
via the published breadcrumbs in 3 page loads, executed 29 of 32 flows PASS
on the first walk, verified all four bonus criteria with evidence, and
scored the entry 8/10 on the job to be done. The verbatim report — including
every stuck point and wart it found, and what we fixed in response — is at
[docs/SELF_JUDGE_RUN_2026-08-11.md](docs/SELF_JUDGE_RUN_2026-08-11.md).
An independent hostile audit ran the day before:
[docs/PRE_JUDGING_AUDIT_2026-08-11.md](docs/PRE_JUDGING_AUDIT_2026-08-11.md).

## Stack

- **Runtime:** one Cloudflare Worker — [Hono](https://hono.dev) JSON API + Vite React SPA served through Workers Assets.
- **Data:** D1 (SQLite) with plain SQL migrations; R2 for uploaded files.
- **Contracts:** Zod schemas in `src/shared/contracts`, used by the API for request validation and by the web app for response validation. Drift fails loudly.
- **Domain logic:** pure, tested functions in `src/shared/domain` (conflicts, acceptance, CFP window, conditional rules). No I/O, injected clocks.
- **Persistence boundary:** `src/worker/repo` — handlers only see the `LecternRepo` interface, and `D1Repo` is the complete product backend. Airtable stays in the rate-safe operational mirror boundary rather than the judging request path.

## Local development

Requires Node 20+ and pnpm.

```bash
pnpm install
cp .dev.vars.example .dev.vars     # local secrets; never committed
pnpm db:migrate:local
pnpm db:seed:local
pnpm dev                           # builds the SPA, then wrangler dev on http://localhost:8787
```

For UI work with hot reload, use two terminals:

```bash
pnpm exec wrangler dev             # terminal 1: API + built assets on :8787
pnpm dev:web                       # terminal 2: Vite dev server, proxies /api to :8787
```

Organizer console: open `/admin` and use the passcode from `.dev.vars` (`lectern-dev` by default).

Public docs and embeds:

- `/docs` or `/api-docs` — endpoint reference and embed snippets.
- `/embed-preview` — live schedule, sessions, and speakers iframes for the seeded event.
- `/api/docs` — machine-readable endpoint index.
- [`/api/public/walkthrough.mp4`](https://lectern.lectern-go7.workers.dev/api/public/walkthrough.mp4) — narrated three-minute submission walkthrough served from R2.

Checks:

```bash
pnpm check     # typecheck (web + worker projects)
pnpm test      # domain tests (vitest)
pnpm build     # production SPA build
pnpm verify    # all checks above plus a Wrangler deployment dry-run
```

## Reimbursement audit

The brief allows a valid submission up to $500 in AI token-cost reimbursement, subject to proof. Every AI work session on this project is logged in an append-only evidence ledger, and the whole trail is designed to be auditable in minutes:

- **[`usage/REPORT.md`](usage/REPORT.md)** — the audit document: workload by model, an evidence inventory tying every ledger entry to its session-log SHA-256 and commits, and the gauge-versus-claim distinction kept explicit.
- `usage/ledger.jsonl` — one immutable entry per measured work period; `usage/pricing.json` pins the list prices used.
- `pnpm usage:check` — validates every entry, recomputes every cost, and **fails if REPORT.md does not byte-match a regeneration from the ledger**, so the report can be neither stale nor hand-edited. `pnpm verify` includes this gate.
- `pnpm usage:report` regenerates the report; `pnpm usage:snapshot` appends new entries from provider session logs and regenerates it automatically.
- `pnpm usage:runtime` imports unseen provider-reported counters from the organizer-only production audit endpoint. The app persists those counters before responding and never stores prompts, reviewer notes, or generated text in the audit table.

Paid model use is fail-closed. Runtime email drafting uses deterministic templates unless `AI_RUNTIME_MODE=enabled` is set in addition to an API key. Reviewer scoring is a narrower exception controlled by `AI_REVIEW_SCORING_MODE`: one explicit Haiku draft per assignment per 15 minutes, never auto-saved, with provider counters logged to `ai_usage_events`; repeat clicks fall back without another charge. The official evaluator must be launched through `pnpm eval:paid`, which requires explicit one-command approval, one scenario, at most 20 turns, and an approved ceiling no greater than $2. `pnpm verify` and the requirement-ledger check are the zero-spend default.
- `pnpm usage:provider-import` backfills provider exports without double-counting app-level request counters; `pnpm usage:receipt` hashes private subscription or API billing evidence and appends a sanitized allocation record without committing raw files.

Raw session transcripts and receipts stay private (hashes are committed, contents are not) and go to the organizer on request with the claim.

Reset the demo to its exact seeded state at any time:

```bash
pnpm db:reset:local
```

## Deploy (Cloudflare)

```bash
pnpm exec wrangler login
pnpm release:preflight             # reports every remaining local release blocker
pnpm cf:provision                  # creates the D1 database and R2 bucket
# copy the database_id printed by d1 create into wrangler.jsonc
pnpm exec wrangler secret put ORGANIZER_PASSCODE
# Optional real email: add both values, verify the sender domain in Resend,
# then change EMAIL_DELIVERY_MODE to "resend" in wrangler.jsonc.
pnpm exec wrangler secret put RESEND_API_KEY
pnpm exec wrangler secret put RESEND_FROM_EMAIL
pnpm exec wrangler secret put EMAIL_DELIVERY_ALLOWLIST
pnpm db:migrate:remote
pnpm db:seed:remote
pnpm deploy                        # vite build && wrangler deploy
```

The deployed URL serves the app, the API, and the seeded demo event immediately.

After Airtable is configured, use the guarded reset for rehearsals and recording:

```bash
LECTERN_ORGANIZER_PASSCODE=lectern-judge-2026 pnpm demo:reset:remote
```

It fails before mutation unless Airtable record reconciliation is available, then restores D1, reconciles the mirror, removes only duplicate app-owned rows, and requires the strict production gate to pass.

After deploy, replace the host in any iframe snippet with the deployed Worker URL.

## API

The JSON API the app uses is the public API.

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/api/health` | — | Health, version, backend, DB/R2 checks |
| GET | `/api/events` | — | List events |
| GET | `/api/events/:slug` | — | Event bundle: event, tracks, rooms, CFP form + fields + rules |
| GET | `/api/public/events/:slug/schedule` | — | Public schedule JSON |
| GET | `/api/public/events/:slug/sessions` | — | Public sessions JSON |
| GET | `/api/public/events/:slug/speakers` | — | Public speaker gallery JSON |
| GET | `/api/public/events/:slug/sessions/:sessionId/calendar.ics` | — | Download scheduled session calendar file |
| GET | `/api/public/walkthrough.mp4` | — | Stream the narrated three-minute submission walkthrough from R2 |
| GET | `/api/embeds/events/:slug/schedule` | — | Iframe schedule HTML |
| GET | `/api/embeds/events/:slug/sessions` | — | Iframe sessions HTML |
| GET | `/api/embeds/events/:slug/speakers` | — | Iframe speaker gallery HTML |
| POST | `/api/events/:slug/submissions` | — | Submit a CFP proposal (validated, conditional-rule aware) |
| GET | `/api/speaker-portal/:token` | Speaker link | Portal sessions, tasks, files, and resources |
| PATCH | `/api/speaker-portal/:token/profile` | Speaker link | Edit the speaker's public profile |
| PUT | `/api/speaker-portal/:token/tasks/:taskId` | Speaker link | Complete or reopen an onboarding task |
| POST | `/api/speaker-portal/:token/assets` | Speaker link | Upload headshot, slides, or document to R2 |
| GET | `/api/events/:slug/submissions` | Bearer passcode | Organizer submissions list |
| GET | `/api/events/:slug/submissions.csv` | Bearer passcode | Formula-safe, Excel-friendly submissions CSV export |
| POST | `/api/events/:slug/submissions/:submissionId/feedback-draft` | Bearer passcode | Editable deny/waitlist feedback draft; AI-assisted only when configured, safe template otherwise |
| GET | `/api/admin/ai-usage` | Bearer passcode | Privacy-safe provider counters for runtime AI calls; no prompts, reviewer notes, or generated text |
| POST | `/api/events/:slug/submissions/:submissionId/decision` | Bearer passcode | Approve, maybe, or deny a proposal |
| GET | `/api/events/:slug/counts` | Bearer passcode | Dashboard counts |
| GET | `/api/events/:slug/agenda` | Bearer passcode | Sessions, placements, and live conflicts |
| POST | `/api/events/:slug/sessions` | Bearer passcode | Add a direct invited/sponsor session |
| PUT | `/api/events/:slug/sessions/:sessionId/slot` | Bearer passcode | Create or move an agenda placement |
| GET | `/api/events/:slug/communications/preview` | Bearer passcode | Preview a reminder or session update |
| POST | `/api/events/:slug/communications/simulate` | Bearer passcode | Deliver through configured transport and persist its receipt (simulated by default) |
| GET | `/api/airtable/status` | Bearer passcode | Airtable mirror connectivity, schema, mapping, and reset-safety state |
| POST | `/api/airtable/events/:slug/sync` | Bearer passcode | Idempotently mirror one event into Airtable |
| POST | `/api/speakers/:speakerId/assets` | Bearer passcode | Upload a speaker file to R2 (multipart: `file`, `kind`) |
| GET | `/api/assets/:assetId` | Asset link | Download/stream a stored asset |
| GET | `/api/admin/ping` | Bearer passcode | Passcode verification (204) |

Errors are uniform: `{ "error": { "code", "message", "issues?" } }`.

Full API and embed details live in [`docs/API.md`](docs/API.md).
The exact Airtable base fields and proof procedure live in [`docs/AIRTABLE.md`](docs/AIRTABLE.md).

## Domain invariants

These are load-bearing. Do not weaken them without the integration owner's sign-off.

1. **Submissions and sessions are distinct.** A submission is an application to speak; a session is a schedulable program item.
2. **Acceptance is idempotent with lineage.** Accepting a submission derives the session id from the submission id, and `sessions.source_submission_id` is UNIQUE — one submission can never produce two sessions. A schema CHECK ties `origin` to lineage.
3. **Sessions can be created directly** (sponsor keynotes, invited panels) with `origin = 'direct'` and no submission behind them.
4. **Agenda slots reference sessions only.** There is no submission reference in the agenda, by design.
5. **Speaker files are first-class `speaker_assets` rows** backed by R2 objects — never URL strings on the speaker row.
6. **Reviews belong to rounds; aggregates are derived,** never stored.
7. **External sync ids are stored** (`external_id_map`) so integration retries update instead of duplicate.

## Demo data

`seed/seed.sql` is deterministic (fixed ids and timestamps) and doubles as the reset: 1 event (Horizon Dev Summit 2026), 4 tracks, 3 rooms, 8 speakers, 10 submissions across the full status spread, 2 accepted-with-lineage sessions, 2 direct sessions, and an agenda that contains one room double-booking and one double-booked speaker for the conflict engine to find. See [`docs/DEMO_DATA.md`](docs/DEMO_DATA.md).

### Loadable conferences

Richer, hand-authored conferences live in [`demo-data/`](demo-data/) as plain JSON that anyone can edit without touching application code. Records reference each other by readable keys (`"rosa-delgado"`), and the loader derives stable database ids from them.

```bash
pnpm demo:check     # validate the files and print what they will produce
```

Then open **`/demo`** in the running app and press **Load**. Loading is idempotent — it deletes that conference and re-inserts it from the files — so the same button is also the reset, which matters because judges will type things into the demo.

The shipped dataset, **Groundwork 2026**, carries 12 speakers, 20 submissions across every status, 10 sessions (9 from accepted submissions with lineage kept, 1 sponsor keynote added directly), two deliberate schedule conflicts, and five speakers with outstanding onboarding tasks. The reasoning behind each awkward record is in [`demo-data/liam-conference.storylines.md`](demo-data/liam-conference.storylines.md).

## Airtable mirror

Plenty of event teams already run their operations out of Airtable. Lectern mirrors an event's records into a base so those people see submissions, decisions, the schedule, and outstanding speaker tasks without opening the app. **The hosted demo's mirror is live**: the first sync built its own tables in a template-created base (adopting the template's Speakers table by adding only its missing columns) and pushed the full seeded event — 53 records across 8 tables; re-syncing updates in place.

**D1 stays authoritative.** Airtable is a mirror, not the backend, and that is a deliberate call:

- Airtable allows **5 requests/second per base**. Serving page loads from it would put a rate limit in the demo path. Mirroring keeps it off the read path entirely.
- Airtable has no transactions or joins, so the submission/session invariants below would be unenforceable there.
- If Airtable is slow or down, the app keeps working and the sync reports a failure. The reverse would take the whole product down.

### Turning it on

Two secrets, and the mirror builds its own tables — you do not hand-build a base.

```bash
wrangler secret put AIRTABLE_TOKEN      # personal access token
wrangler secret put AIRTABLE_BASE_ID    # the appXXXXXXXX id from the base URL
```

The token needs four scopes: `schema.bases:read`, `schema.bases:write` (so the mirror can create the tables), `data.records:read` (so resets reconcile rather than duplicate rows), and `data.records:write`. Grant it access to the one base you want mirrored.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/airtable/status` | Whether it is configured and reachable, which tables exist, and what has been mirrored |
| POST | `/api/airtable/events/:slug/sync` | Push an event's records. Safe to run repeatedly |

Both need the organizer passcode. The token is read from Worker secrets and never reaches the browser — status reports *whether* a token is configured, never its value.

### Why re-syncing is safe

Every internal row is mapped to its Airtable record id in the `external_id_map` table. Known rows are updated in place; only genuinely new rows are created. Press Sync ten times and you get the same records, not ten copies. Writes are batched to Airtable's 10-record limit and spaced under the rate cap, and a 429 is retried with the server's own `Retry-After`.

That idempotency is covered by tests rather than asserted: a second sync of unchanged data creates nothing and updates everything, and a 23-record table batches as 10 / 10 / 3.

## Deliberately deferred

- Visual form-builder, reviewer assignments, and multi-round review management beyond the working decision queue.
- Provider webhooks for bounce/complaint lifecycle updates. Real Resend submission and provider IDs are supported; previews, calendar handoffs, and persisted simulated receipts remain available without credentials.
- Accelevents-specific field mapping/import, dark mode, and exhaustive mobile admin polish. A generic submissions CSV export is already included.

## Contributing

You do not need to know Cloudflare, Hono, or D1 to help.

- **Demo data and storylines** — edit JSON in [`demo-data/`](demo-data/), run `pnpm demo:check`, load it at `/demo`. Start with [`demo-data/README.md`](demo-data/README.md).
- **QA** — use the app as a speaker and as an organizer, and open a `speaker-qa` issue for anything confusing.
- **Copy and empty states** — open a `ux-polish` issue with the current wording and your version.

Issue templates for each of these live in [`.github/ISSUE_TEMPLATE/`](.github/ISSUE_TEMPLATE/).

## Credits

Demo data and QA: Liam.

## License

[MIT](LICENSE)
