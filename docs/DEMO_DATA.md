# Demo Data and Reset

`seed/seed.sql` is deterministic. It deletes child rows first, then re-inserts fixed ids and timestamps so every local reset returns to the same demo state. Production uses a guarded wrapper that proves Airtable record-read access before mutation, reseeds D1, reconciles live IDs, removes only duplicate app-owned rows, and runs the strict smoke gate.

## Reset Commands

```bash
pnpm db:reset:local
LECTERN_ORGANIZER_PASSCODE=lectern-judge-2026 pnpm db:reset:remote
```

The local reset aliases the local seed. The raw remote seed remains available for first-time provisioning only:

```bash
pnpm db:seed:local
pnpm db:seed:remote
```

Do not use the raw remote seed for a live judging reset; it intentionally knows nothing about external mirror state.

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
