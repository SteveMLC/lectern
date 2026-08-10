import { Hono } from "hono";
import type { Env } from "../env";

/**
 * Agent-readable entry point. Judges at an AI-tooling hackathon plausibly
 * evaluate with agents; /llms.txt hands one everything it needs in a single
 * fetch: what this is, the live demo (no account required), the passcode, the
 * machine-readable API index, and the judging chain to walk.
 */
export const llms = new Hono<{ Bindings: Env }>();

const BODY = `# SpeakerOps

> Open-source replacement for the program side of Sessionboard: CFP forms with
> conditional logic, review decisions, agenda with live conflict detection,
> speaker portal with real file uploads, communications with .ics invites, and
> embeddable public pages. One Cloudflare Worker + D1 + R2.

## Try it — no account, no sign-in

Everything is walkable right now:

- Live app: https://speakerops.speakerops-go7.workers.dev
- Organizer console: https://speakerops.speakerops-go7.workers.dev/admin
  Passcode: speakerops-judge-2026 (deliberately public for judging)
- Public CFP (submit for real): https://speakerops.speakerops-go7.workers.dev/e/horizon-2026/cfp
- Speaker portal example: https://speakerops.speakerops-go7.workers.dev/speaker/spk_ada
- Embeds preview: https://speakerops.speakerops-go7.workers.dev/embed-preview
- Load a second, resettable conference: https://speakerops.speakerops-go7.workers.dev/demo

## The chain to judge

1. Submit a proposal at /e/horizon-2026/cfp — pick Workshop as format and a
   conditionally required field appears; the API enforces the same rule.
2. Open /admin -> Reviews: your proposal is there with the speaker's bio and
   form answers. Approve it — exactly one session is created, idempotently,
   with source lineage.
3. /admin/agenda: place it; room and speaker double-bookings are flagged live
   (two conflicts ship pre-staged in the seed data).
4. /admin -> add a direct sponsor session — no submission behind it, by design.
5. The portal shows derived onboarding tasks; upload a real file (R2).
6. /admin/communications: previewed reminder, simulated send with receipt,
   downloadable .ics carrying the session.
7. /embed-preview: mobile-first schedule, sessions, and speaker gallery.

## Machine-readable

- API index (JSON): https://speakerops.speakerops-go7.workers.dev/api/docs
- Health: https://speakerops.speakerops-go7.workers.dev/api/health
- Public schedule JSON: https://speakerops.speakerops-go7.workers.dev/api/public/events/horizon-2026/schedule

## Source and docs

- GitHub: https://github.com/SteveMLC/speakerops (MIT)
- README covers local dev (one command, zero cloud accounts), deploy, the
  domain invariants, and the tamper-evident AI-usage reimbursement audit in
  usage/REPORT.md.

## Honest limits

The Airtable mirror is LIVE on this deployment: POST /api/airtable/events/horizon-2026/sync
(organizer passcode) pushes the event's records into the organizer's base,
idempotently — re-syncing updates in place. The agenda uses explicit room/time
controls plus a live conflict engine rather than drag-and-drop; Accelevents
was ruled optional by the organizer FAQ and is not built.
`;

llms.get("/llms.txt", (c) =>
  c.text(BODY, 200, { "cache-control": "public, max-age=300" }),
);
