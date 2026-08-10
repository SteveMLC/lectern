# SpeakerOps

**CFP to published agenda, without the enterprise tax.**

SpeakerOps is an open-source replacement for the program side of Sessionboard: call-for-speakers forms with conditional logic, proposal decisions, acceptance-to-session flow, room/time agenda controls with conflict detection, a speaker portal with real file uploads, templated communications with calendar invites, and embeddable public schedule, session, and speaker pages.

Built for [Kill My SaaS 1](https://forge.smol.ai/). Cloudflare-native: one Worker serves the API and the app, D1 stores operational data, R2 stores speaker assets, and a rate-safe Airtable proof adapter reads event/speaker operations and writes communication receipts behind the same repository boundary.

## Try it live

**https://speakerops.speakerops-go7.workers.dev**

Organizer passcode: **`speakerops-judge-2026`** — a deliberately public demo passcode, not a credential. It is distinct from the local development default, so a checkout of this repo never shares a passcode with the hosted demo. On your own deploy, set your own with `wrangler secret put ORGANIZER_PASSCODE`.

A five-minute tour, in order:

| # | Do this | What it proves |
| --- | --- | --- |
| 1 | [Open the event page](https://speakerops.speakerops-go7.workers.dev/e/horizon-2026) | Seeded conference: 4 tracks, 3 rooms, CFP open |
| 2 | [Submit a proposal](https://speakerops.speakerops-go7.workers.dev/e/horizon-2026/cfp) — pick **Workshop** as the format | A conditional field appears, and it is required. Switch back to Talk and it vanishes. The API enforces the same rule, so a hidden field is never demanded |
| 3 | [Open the organizer console](https://speakerops.speakerops-go7.workers.dev/admin) and go to Submissions | Your proposal is there with its speaker attached — the full public-to-organizer round trip |
| 4 | [Load a second conference](https://speakerops.speakerops-go7.workers.dev/demo) | A hand-authored dataset with staged scheduling conflicts. The same button resets it, so you can break anything here safely |
| 5 | [View the embeds](https://speakerops.speakerops-go7.workers.dev/embed-preview) | Iframe-ready schedule, sessions, and speaker gallery. Narrow the window — they are mobile-first |

Break the demo on purpose. **Reset** on `/demo` restores the loaded conference to exactly what its files describe, and the seeded event has a one-command reset too.

## Status

Scaffold + golden path. Working today:

- Public event page and CFP form with **live conditional field logic** (the workshop-length field appears only for workshop proposals, and the API enforces the same rule server-side).
- **Golden path**: public CFP submission → persisted in D1 → visible in the organizer submissions console, with speaker dedup by email.
- Organizer console (passcode-gated): dashboard counts, searchable submissions, Approve/Maybe/Deny decisions, direct invited sessions, and a room-based agenda with live room/speaker conflicts.
- **Speaker portal**: demo-link profile editing, onboarding task completion, and speaker-facing R2 upload/download as first-class asset records. Production-grade expiring links are deliberately not claimed.
- **Communications**: task-reminder and session-update previews, persisted simulated sends, and downloadable `.ics` calendar handoffs.
- **Airtable proof**: cached Events/Speakers reads, Messages writes, 5 req/s protection, 429 retries, explicit D1 fallback, and an organizer status screen.
- **Public embeds**: iframe-friendly schedule, sessions, and speaker gallery routes backed by the same D1 program data.
- **API docs**: `/docs`, `/api-docs`, `/embed-preview`, and machine-readable `/api/docs`.
- Deterministic demo seed and one-command reset.
- Domain layer with tests: schedule conflict detection (room + speaker double-booking), guarded review transitions, and idempotent acceptance-to-session conversion.

The judging-critical product path is live on Cloudflare Workers with D1 and R2 provisioned. Release and walkthrough status lives in [`docs/CRITICAL_PATH.md`](docs/CRITICAL_PATH.md).

Engineering handoff status and the ordered judging-critical lane map live in [`docs/CRITICAL_PATH.md`](docs/CRITICAL_PATH.md).

## Hackathon scope clarifications

Latest organizer FAQ from Discord:

- Basic conditional form logic is enough for MVP; the current shared browser/API rule is the right foundation.
- Talks can be routed to one or more tracks, and reviewers can cover one or more tracks.
- Minimum review flow: `unreviewed` -> `approve` / `maybe` / `deny`.
- Decision email from inside the app is a bonus, especially when it can carry feedback or change requests.
- Day/room scheduling with drag-and-drop and conflict detection is enough.
- Email/calendar workflows should exist at MVP depth through preview/simulated send, with Resend or Cloudflare email wiring when a key is available.
- Accelevents is optional and may be skipped. A mapping preview or CSV handoff is sufficient if we include anything.
- Admin UI is the highest-priority surface.

## Stack

- **Runtime:** one Cloudflare Worker — [Hono](https://hono.dev) JSON API + Vite React SPA served through Workers Assets.
- **Data:** D1 (SQLite) with plain SQL migrations; R2 for uploaded files.
- **Contracts:** Zod schemas in `src/shared/contracts`, used by the API for request validation and by the web app for response validation. Drift fails loudly.
- **Domain logic:** pure, tested functions in `src/shared/domain` (conflicts, acceptance, CFP window, conditional rules). No I/O, injected clocks.
- **Persistence boundary:** `src/worker/repo` — handlers only see the `SpeakerOpsRepo` interface. `D1Repo` is the working default; `AirtableRepo` is the compiling boundary for live Airtable persistence (`DATA_BACKEND` switches).

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

Organizer console: open `/admin` and use the passcode from `.dev.vars` (`speakerops-dev` by default).

Public docs and embeds:

- `/docs` or `/api-docs` — endpoint reference and embed snippets.
- `/embed-preview` — live schedule, sessions, and speakers iframes for the seeded event.
- `/api/docs` — machine-readable endpoint index.

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
pnpm db:migrate:remote
pnpm db:seed:remote
pnpm deploy                        # vite build && wrangler deploy
```

The deployed URL serves the app, the API, and the seeded demo event immediately.

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
| GET | `/api/embeds/events/:slug/schedule` | — | Iframe schedule HTML |
| GET | `/api/embeds/events/:slug/sessions` | — | Iframe sessions HTML |
| GET | `/api/embeds/events/:slug/speakers` | — | Iframe speaker gallery HTML |
| POST | `/api/events/:slug/submissions` | — | Submit a CFP proposal (validated, conditional-rule aware) |
| GET | `/api/speaker-portal/:token` | Speaker link | Portal sessions, tasks, files, and resources |
| PATCH | `/api/speaker-portal/:token/profile` | Speaker link | Edit the speaker's public profile |
| PUT | `/api/speaker-portal/:token/tasks/:taskId` | Speaker link | Complete or reopen an onboarding task |
| POST | `/api/speaker-portal/:token/assets` | Speaker link | Upload headshot, slides, or document to R2 |
| GET | `/api/events/:slug/submissions` | Bearer passcode | Organizer submissions list |
| POST | `/api/events/:slug/submissions/:submissionId/decision` | Bearer passcode | Approve, maybe, or deny a proposal |
| GET | `/api/events/:slug/counts` | Bearer passcode | Dashboard counts |
| GET | `/api/events/:slug/agenda` | Bearer passcode | Sessions, placements, and live conflicts |
| POST | `/api/events/:slug/sessions` | Bearer passcode | Add a direct invited/sponsor session |
| PUT | `/api/events/:slug/sessions/:sessionId/slot` | Bearer passcode | Create or move an agenda placement |
| GET | `/api/events/:slug/communications/preview` | Bearer passcode | Preview a reminder or session update |
| POST | `/api/events/:slug/communications/simulate` | Bearer passcode | Persist a simulated delivery receipt |
| GET | `/api/integrations/airtable/status` | Bearer passcode | Airtable proof connectivity and D1 fallback state |
| POST | `/api/speakers/:speakerId/assets` | Bearer passcode | Upload a speaker file to R2 (multipart: `file`, `kind`) |
| GET | `/api/assets/:assetId` | — | Download/stream a stored asset |
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

Plenty of event teams already run their operations out of Airtable. SpeakerOps mirrors an event's records into a base so those people see submissions, decisions, the schedule, and outstanding speaker tasks without opening the app.

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

The token needs three scopes: `schema.bases:read`, `schema.bases:write` (so the mirror can create the tables), and `data.records:write`. Grant it access to the one base you want mirrored.

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
- Drag-and-drop and alternate agenda views; the working explicit room/time controls are faster and safer for the judging demo.
- Real email delivery; previews, calendar attachments, and persisted simulated delivery work without third-party credentials.
- Full Airtable mirroring; the adapter proves rate-safe Events/Speakers reads and Messages writes while D1 remains the complete backend.
- Optional Accelevents CSV/mapping handoff, dark mode, and exhaustive mobile admin polish.

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
