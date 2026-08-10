# Airtable mirror

SpeakerOps keeps D1 as the authoritative backend. Airtable is a mirror for event teams that want to see operational records in a familiar base: event setup, tracks, rooms, speakers, submissions, sessions, agenda slots, and speaker tasks.

The mirror creates its own Airtable tables. Start with an empty base; do not build the schema by hand.

## Required Airtable Setup

1. Create an empty Airtable base, for example `SpeakerOps Mirror`.
2. Copy the base id from the URL. It starts with `app`, for example `appXXXXXXXXXXXXXX`.
3. Create a personal access token at `https://airtable.com/create/tokens`.
4. Grant the token only this base, not all bases.
5. Give the token exactly these scopes:

| Scope | Why SpeakerOps needs it |
| --- | --- |
| `schema.bases:read` | Check which mirror tables already exist. |
| `schema.bases:write` | Create missing mirror tables automatically. |
| `data.records:read` | Reconcile live SpeakerOps IDs after a D1 reset and prevent duplicate remote rows. |
| `data.records:write` | Create and update mirrored records. |

Set the production Worker secrets without committing them:

```sh
pnpm exec wrangler secret put AIRTABLE_TOKEN
pnpm exec wrangler secret put AIRTABLE_BASE_ID
```

The token is read from Worker secrets and never sent to the browser. Status endpoints report whether Airtable is configured and reachable; they never return secret values.

## Mirror Tables

The first sync creates these eight tables if they do not already exist:

| Table | What it mirrors |
| --- | --- |
| Events | Event identity, dates, timezone, venue. |
| Tracks | Program tracks. |
| Rooms | Room names and capacity. |
| Speakers | Speaker contact/profile basics. |
| Submissions | CFP submissions and decisions. |
| Sessions | Accepted/direct sessions. |
| Agenda | Scheduled session slots. |
| Tasks | Speaker onboarding tasks. |

Every table includes `SpeakerOps ID`, the stable internal id used for idempotent updates.

## API

Both endpoints require the organizer passcode.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/airtable/status` | Reports whether the Worker has Airtable secrets, whether the base is reachable, existing base tables, and the latest sync summary. |
| POST | `/api/airtable/events/:slug/sync` | Pushes one event's operational records to Airtable. Safe to run repeatedly. |

Current seeded event slug:

```text
horizon-2026
```

## Why Re-Syncing Is Safe

SpeakerOps records every created Airtable record id in `external_id_map`. On the next sync, known rows are updated in place and only genuinely new rows are created. Re-running the same event should not create duplicates.

The sync also:

- Batches writes at Airtable's 10-record limit.
- Serializes requests with at least 210 ms between starts, staying under Airtable's 5 requests/second per-base limit.
- Retries HTTP 429 responses with Airtable's own `Retry-After` header.
- Leaves orphaned Airtable rows in place and reports them rather than deleting unexpectedly.

Automated coverage lives in:

- `src/worker/integrations/airtableClient.test.ts`
- `src/worker/integrations/airtableSync.test.ts`
- `src/shared/domain/airtableMirror.test.ts`

## Boundary

Do not switch the judging demo to Airtable as the primary backend. D1 remains the complete, reliable product backend; Airtable is the operational mirror/proof.
