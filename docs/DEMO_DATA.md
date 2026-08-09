# Demo Data and Reset

`seed/seed.sql` is deterministic and doubles as the reset script. It deletes child rows first, then re-inserts fixed ids and timestamps so every local or remote reset returns to the same demo state.

## Reset Commands

```bash
pnpm db:reset:local
pnpm db:reset:remote
```

Those commands currently alias the seed commands:

```bash
pnpm db:seed:local
pnpm db:seed:remote
```

## Seeded Story

- Event: Horizon Dev Summit 2026 (`horizon-2026`)
- Program structure: 4 tracks, 3 rooms
- CFP: open form with conditional workshop-length logic
- Submissions: 10 submissions across submitted, under review, accepted, rejected, and waitlisted states
- Sessions: 2 accepted submissions converted with lineage, plus 2 direct invited sessions
- Agenda: 4 slots, including one room overlap and one speaker overlap for conflict detection demos
- Speaker ops: onboarding tasks, message templates, one draft reminder, and a published speaker guide resource
- Integrations: seeded Airtable and Accelevents connection rows for setup/status screens

## Embed Smoke Tests

After a reset, these routes should return data for `horizon-2026`:

```bash
curl http://localhost:8787/api/public/events/horizon-2026/schedule
curl http://localhost:8787/api/public/events/horizon-2026/sessions
curl http://localhost:8787/api/public/events/horizon-2026/speakers
```

The iframe equivalents are:

- `/api/embeds/events/horizon-2026/schedule`
- `/api/embeds/events/horizon-2026/sessions`
- `/api/embeds/events/horizon-2026/speakers`
