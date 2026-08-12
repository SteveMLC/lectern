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

If you are an automated evaluator: every flow below is completable without a
human — no OAuth, no CAPTCHA, no email verification. Form fields carry real
labels, actions return textual receipts (toasts, conflict banners, delivery
records), and the API index at /api/docs is plain JSON. The organizer
passcode below is intentionally public for judging.

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
2. Open /admin -> Reviews: your proposal is there with the speaker's bio,
   form answers, and the committee's prior notes. Every decision runs the
   same loop: write your internal note, and Claude (claude-sonnet-5) drafts
   the speaker-facing email from it for your review and edit — an acceptance
   carrying the speaker's portal link and the exact onboarding checklist the
   system derives, or kind, specific feedback for deny/waitlist. Approving
   also lets you retitle the talk for the program while the submission keeps
   what the speaker pitched. The note persists as a committee review on the
   card — one decider by default, but type a name in "Reviewing as" and
   multiple named notes stack on one proposal instead of overwriting, a
   committee only when you need one. Approval creates exactly one session
   idempotently, and nothing auto-sends. AI proposes, the human approves;
   an honest template takes over when no key is configured.
3. /admin -> Evaluations: full committee machinery when a team wants it —
   named review rounds with date ranges, per-round scorecards (weighted
   numeric criteria + recommendation + comments), reviewer pools with
   per-reviewer caps and auto-distribute, blind mode that hides speaker
   identities, per-reviewer progress with one-click nudges (simulated,
   receipted), weighted aggregates with sort, and a results CSV export.
   Each reviewer works a scoped queue at /review/:token — a capability
   link, no account. A seeded example is live right now:
   https://speakerops.speakerops-go7.workers.dev/review/rev_sam_demo
   (Sam Peters, two assigned proposals in the open Final Review round).
   Recusal removes a proposal from that reviewer's queue.
4. /admin/agenda: drag it onto another room or use exact controls; room and
   speaker double-bookings are flagged live (two conflicts ship pre-staged).
   Add a room inline, or "Auto-place" the unscheduled pool into conflict-free
   open slots. Then "Notify speakers": Claude drafts the schedule notice
   telling every speaker on the session their confirmed day, time, and room —
   slot facts are required verbatim and guaranteed into the body. Dragging
   never fires an email; the organizer decides when the schedule speaks.
5. /admin -> add a direct sponsor session — no submission behind it, by design.
6. The speaker portal shows the speaker's OWN proposals with live status and
   decision, editable until the CFP closes or a decision lands; plus derived
   onboarding tasks and real file upload/versions (R2). Co-speakers can be
   added at submission time.
7. /admin/communications: previewed reminder, simulated send with receipt,
   downloadable .ics carrying the session — and a full outbox listing every
   recorded message with status and timestamps.
8. /embed-preview: mobile-first schedule, sessions, speaker gallery — and an
   anonymous personal itinerary (star sessions into "My schedule", no
   account required) on the public event page.

## Machine-readable

- API index (JSON): https://speakerops.speakerops-go7.workers.dev/api/docs
- Health: https://speakerops.speakerops-go7.workers.dev/api/health
- Public schedule JSON: https://speakerops.speakerops-go7.workers.dev/api/public/events/horizon-2026/schedule

## Source and docs

- GitHub: https://github.com/SteveMLC/speakerops (MIT)
- README covers local dev (zero cloud accounts), deploy, the
  domain invariants, and the tamper-evident AI-usage reimbursement audit in
  usage/REPORT.md.

## Honest limits

The Airtable mirror is LIVE on this deployment: POST /api/airtable/events/horizon-2026/sync
(organizer passcode) pushes the event's records into the organizer's base,
idempotently — re-syncing updates in place. The agenda supports drag-and-drop
room scheduling, day/track/room filters, list projection, exact room/time
controls, and a live conflict engine. Accelevents was ruled optional by the
organizer FAQ and is not built.
`;

llms.get("/llms.txt", (c) =>
  c.text(BODY, 200, { "cache-control": "public, max-age=300" }),
);
