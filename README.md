# SpeakerOps

**CFP to published agenda, without the enterprise tax.**

SpeakerOps is an open-source replacement for the program side of Sessionboard: call-for-speakers forms with conditional logic, submission review rounds, acceptance-to-session flow, drag-and-drop agenda with conflict detection, a speaker portal with real file uploads, templated communications with calendar invites, and embeddable public schedule/speaker pages.

Built for [Kill My SaaS 1](https://forge.smol.ai/). Cloudflare-native: one Worker serves the API and the app, D1 stores operational data, R2 stores speaker assets, and an Airtable adapter (behind a repository boundary) mirrors the live operational record for teams that run on Airtable.

## Status

Scaffold + golden path. Working today:

- Public event page and CFP form with **live conditional field logic** (the workshop-length field appears only for workshop proposals, and the API enforces the same rule server-side).
- **Golden path**: public CFP submission → persisted in D1 → visible in the organizer submissions console, with speaker dedup by email.
- Organizer console (passcode-gated): dashboard counts and the submissions table with status filters.
- **R2 uploads**: speaker asset upload/download round trip as first-class records.
- Deterministic demo seed and one-command reset.
- Domain layer with tests: schedule conflict detection (room + speaker double-booking) and idempotent acceptance-to-session conversion.

The remaining workflows (reviews UI, agenda board, speaker portal, communications, embeds, Accelevents/Airtable sync) build on these contracts — see Roadmap.

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

Checks:

```bash
pnpm check     # typecheck (web + worker projects)
pnpm test      # domain tests (vitest)
pnpm build     # production SPA build
```

Reset the demo to its exact seeded state at any time:

```bash
pnpm db:reset:local
```

## Deploy (Cloudflare)

```bash
pnpm exec wrangler login
pnpm cf:provision                  # creates the D1 database and R2 bucket
# copy the database_id printed by d1 create into wrangler.jsonc
pnpm exec wrangler secret put ORGANIZER_PASSCODE
pnpm db:migrate:remote
pnpm db:seed:remote
pnpm deploy                        # vite build && wrangler deploy
```

The deployed URL serves the app, the API, and the seeded demo event immediately.

## API

The JSON API the app uses is the public API.

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/api/health` | — | Health, version, backend, DB/R2 checks |
| GET | `/api/events` | — | List events |
| GET | `/api/events/:slug` | — | Event bundle: event, tracks, rooms, CFP form + fields + rules |
| POST | `/api/events/:slug/submissions` | — | Submit a CFP proposal (validated, conditional-rule aware) |
| GET | `/api/events/:slug/submissions` | Bearer passcode | Organizer submissions list |
| GET | `/api/events/:slug/counts` | Bearer passcode | Dashboard counts |
| POST | `/api/speakers/:speakerId/assets` | Bearer passcode | Upload a speaker file to R2 (multipart: `file`, `kind`) |
| GET | `/api/assets/:assetId` | — | Download/stream a stored asset |
| GET | `/api/admin/ping` | Bearer passcode | Passcode verification (204) |

Errors are uniform: `{ "error": { "code", "message", "issues?" } }`.

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

`seed/seed.sql` is deterministic (fixed ids and timestamps) and doubles as the reset: 1 event (Horizon Dev Summit 2026), 4 tracks, 3 rooms, 8 speakers, 10 submissions across the full status spread, 2 accepted-with-lineage sessions, 2 direct sessions, and an agenda that contains one room double-booking and one double-booked speaker for the conflict engine to find.

## Roadmap (post-scaffold lanes)

- **Lane A — CFP + review:** form builder UI, reviewer assignments, two scoring rounds, accept/reject decisions.
- **Lane B — sessions + agenda + Accelevents:** acceptance flow UI, direct-add sessions, drag-and-drop agenda with the conflict engine, list/day/week views, Accelevents mapping preview + sync log + CSV fallback.
- **Lane C — speaker operations:** magic-link portal, profile editing, R2 headshot/slides uploads, task board, reminders with real `.ics` files (simulated outbox by default, Resend behind a secret).
- **Lane D — public surface + hardening:** dashboard metrics, schedule/speaker-gallery embeds, API docs, Airtable live persistence, demo reset UI, accessibility and performance passes.

## License

[MIT](LICENSE)
