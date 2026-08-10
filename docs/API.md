# SpeakerOps API and Embeds

SpeakerOps exposes the same public program data as JSON and iframe-ready HTML. Public routes do not require auth and do not include speaker email addresses, review data, private tasks, or organizer notes.

## Public JSON

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Service, version, backend, D1/R2 checks |
| GET | `/api/events` | Public event list |
| GET | `/api/events/:slug` | Event bundle for public event and CFP pages |
| GET | `/api/public/events/:slug/schedule` | Event schedule with slots, rooms, sessions, tracks, and public speakers |
| GET | `/api/public/events/:slug/sessions` | Confirmed sessions with tracks and public speakers |
| GET | `/api/public/events/:slug/speakers` | Public speaker gallery |
| GET | `/api/public/events/:slug/sessions/:sessionId/calendar.ics` | Download a scheduled session calendar file |
| POST | `/api/events/:slug/submissions` | Public CFP proposal intake |
| GET | `/api/speaker-portal/:token` | Magic-link speaker portal bundle |
| PATCH | `/api/speaker-portal/:token/profile` | Update the linked speaker profile |
| PUT | `/api/speaker-portal/:token/tasks/:taskId` | Complete or reopen an onboarding task |
| POST | `/api/speaker-portal/:token/assets` | Upload headshot/slides/document to R2 from the speaker portal |

## Organizer API

Organizer routes require `Authorization: Bearer <ORGANIZER_PASSCODE>`.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/events/:slug/submissions` | Organizer submissions list |
| POST | `/api/events/:slug/submissions/:submissionId/decision` | Approve, maybe, or deny; approval creates/reuses one session |
| GET | `/api/events/:slug/counts` | Dashboard counts |
| GET | `/api/events/:slug/agenda` | Sessions, room placements, and computed conflicts |
| POST | `/api/events/:slug/sessions` | Add a direct invited/sponsor session |
| PUT | `/api/events/:slug/sessions/:sessionId/slot` | Create or move a session placement |
| GET | `/api/events/:slug/communications/preview` | Render task-reminder or session-update email |
| POST | `/api/events/:slug/communications/simulate` | Persist a simulated send and delivery receipt |
| POST | `/api/speakers/:speakerId/assets` | Multipart R2 asset upload with `file` and `kind` |
| GET | `/api/admin/ping` | Passcode verification |

Errors use one shape:

```json
{ "error": { "code": "event_not_found", "message": "No event with that slug." } }
```

## Current Build Priorities

The organizer clarified in Discord that the admin path is the priority and Accelevents is not required for the hackathon MVP.

Build API coverage in this order:

1. CFP conditional validation and track routing.
2. Organizer submissions and review decisions: `unreviewed`, `approve`, `maybe`, `deny`.
3. Acceptance-to-session conversion and direct session creation.
4. Agenda day/room placement with room and speaker conflict detection.
5. Speaker tasks, asset uploads, reminder/calendar previews.
6. Public schedule/session/speaker embeds.
7. Airtable persistence proof.
8. Optional Accelevents mapping/CSV handoff.

## Iframe Embeds

The iframe routes return standalone HTML with inline CSS and a short public cache TTL.

```html
<iframe
  src="https://your-worker.example/api/embeds/events/horizon-2026/schedule"
  title="Horizon Dev Summit schedule"
  width="100%"
  height="640"
  loading="lazy"
></iframe>
```

```html
<iframe
  src="https://your-worker.example/api/embeds/events/horizon-2026/sessions"
  title="Horizon Dev Summit sessions"
  width="100%"
  height="640"
  loading="lazy"
></iframe>
```

```html
<iframe
  src="https://your-worker.example/api/embeds/events/horizon-2026/speakers"
  title="Horizon Dev Summit speakers"
  width="100%"
  height="640"
  loading="lazy"
></iframe>
```

## Built-In Docs

After local dev or deploy:

- `/docs` or `/api-docs` shows the human-readable docs page in the React app.
- `/embed-preview` renders the three live iframes for the seeded demo event.
- `/api/docs` returns a compact machine-readable endpoint index and example snippets.
