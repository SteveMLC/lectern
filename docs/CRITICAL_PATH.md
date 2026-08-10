# SpeakerOps Critical Path

This repo is accepted as the foundation for the hackathon build. It is not submission-ready yet.

## Verified Foundation

- Clean `main` branch pushed to `SteveMLC/speakerops`.
- Scaffold commit lineage includes `2995105 docs: capture organizer scope clarifications`.
- Typecheck, tests, production build, local Worker, D1, R2 binding, organizer auth, seeded data, CFP, embeds, and API routes have been verified locally.
- Browser verification found a coherent organizer dashboard and no runtime errors.

## Honest Gaps

- Reviews, agenda, speakers, communications, resources, and integrations are still placeholder screens in `src/web/App.tsx`.
- Speaker portal is mostly read-only: no bio editing, task completion, or speaker-facing upload yet.
- R2 works through an admin API, not the speaker workflow.
- `AirtableRepo` compiles but is not wired into the live app path.
- No review decision mutation, acceptance UI, direct-session UI, drag-and-drop agenda, communication preview, or ICS generation exists yet.
- Cloudflare deploy is blocked until Wrangler is authenticated and the real D1 database id replaces the placeholder in `wrangler.jsonc`.

## Handoff Order

1. Reviews: `approve` / `maybe` / `deny`, then idempotent acceptance to session.
2. Direct-add sponsor session.
3. Day/room agenda with drag-and-drop and live conflicts.
4. Editable speaker portal with R2 uploads and task completion.
5. Reminder preview plus valid `.ics`.
6. Airtable proof.
7. Deploy, walkthrough QA, and polish.

## Cut From MVP

Accelevents is optional per organizer clarification. Keep it to a mapping preview or CSV handoff only if the critical path is already stable.
