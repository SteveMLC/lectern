# SpeakerOps

**CFP to published agenda, without the enterprise tax.**

SpeakerOps is an open-source replacement for the program side of Sessionboard: call-for-speakers forms with conditional logic, submission review rounds, acceptance-to-session flow, drag-and-drop agenda with conflict detection, a speaker portal with real file uploads, templated communications with calendar invites, and embeddable public schedule, session, and speaker pages.

Built for [Kill My SaaS 1](https://forge.smol.ai/). Cloudflare-native: one Worker serves the API and the app, D1 stores operational data, R2 stores speaker assets, and an Airtable adapter (behind a repository boundary) mirrors the live operational record for teams that run on Airtable.

## Status

Scaffold + golden path. Working today:

- Public event page and CFP form with **live conditional field logic** (the workshop-length field appears only for workshop proposals, and the API enforces the same rule server-side).
- **Golden path**: public CFP submission → persisted in D1 → visible in the organizer submissions console, with speaker dedup by email.
- Organizer console (passcode-gated): dashboard counts and the submissions table with status filters.
- **R2 uploads**: speaker asset upload/download round trip as first-class records.
- **Public embeds**: iframe-friendly schedule, sessions, and speaker gallery routes backed by the same D1 program data.
- **API docs**: `/docs`, `/api-docs`, `/embed-preview`, and machine-readable `/api/docs`.
- Deterministic demo seed and one-command reset.
- Domain layer with tests: schedule conflict detection (room + speaker double-booking) and idempotent acceptance-to-session conversion.

The remaining workflows (reviews UI, agenda board, deeper speaker portal polish, communications, Airtable proof, and optional Accelevents handoff) build on these contracts — see Roadmap.

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
| GET | `/api/embeds/events/:slug/schedule` | — | Iframe schedule HTML |
| GET | `/api/embeds/events/:slug/sessions` | — | Iframe sessions HTML |
| GET | `/api/embeds/events/:slug/speakers` | — | Iframe speaker gallery HTML |
| POST | `/api/events/:slug/submissions` | — | Submit a CFP proposal (validated, conditional-rule aware) |
| GET | `/api/events/:slug/submissions` | Bearer passcode | Organizer submissions list |
| GET | `/api/events/:slug/counts` | Bearer passcode | Dashboard counts |
| POST | `/api/speakers/:speakerId/assets` | Bearer passcode | Upload a speaker file to R2 (multipart: `file`, `kind`) |
| GET | `/api/assets/:assetId` | — | Download/stream a stored asset |
| GET | `/api/admin/ping` | Bearer passcode | Passcode verification (204) |

Errors are uniform: `{ "error": { "code", "message", "issues?" } }`.

Full API and embed details live in [`docs/API.md`](docs/API.md).

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

## Roadmap (post-scaffold lanes)

- **Lane A — CFP + review:** form builder UI, track routing, reviewer assignments, `unreviewed` -> `approve` / `maybe` / `deny`, and optional decision email feedback.
- **Lane B — sessions + agenda:** acceptance flow UI, direct-add sessions, drag-and-drop day/room agenda with conflict detection, list/day/week views if time allows.
- **Lane C — speaker operations:** magic-link portal, profile editing, R2 headshot/slides uploads, task board, reminder/calendar preview with real `.ics` files (simulated outbox by default, Resend or Cloudflare email behind a secret).
- **Lane D — public surface + hardening:** dashboard metrics, Airtable live persistence, demo reset UI, optional Accelevents CSV/mapping handoff, accessibility and performance passes.

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
