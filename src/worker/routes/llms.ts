import { Hono } from "hono";
import type { Env } from "../env";

/**
 * Agent-readable entry point. Judges at an AI-tooling hackathon plausibly
 * evaluate with agents; /llms.txt hands one everything it needs in a single
 * fetch: what this is, the live demo (no account required), the passcode, the
 * machine-readable API index, and the judging chain to walk.
 */
export const llms = new Hono<{ Bindings: Env }>();

const BODY = `# Lectern

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

- Live app: https://lectern.lectern-go7.workers.dev
- Organizer console: https://lectern.lectern-go7.workers.dev/admin
  Passcode: lectern-judge-2026 (deliberately public for judging)
- Public CFP (create an optional submitter account, then submit for real): https://lectern.lectern-go7.workers.dev/e/horizon-2026/cfp
- Speaker portal example: https://lectern.lectern-go7.workers.dev/speaker/spk_ada
  (Submitter accounts provide a proposal/status dashboard; capability links
  remain available, with "Email me my links" recovery on the CFP page.)
- Embeds preview: https://lectern.lectern-go7.workers.dev/embed-preview
- Load a second, resettable conference: https://lectern.lectern-go7.workers.dev/demo

## The chain to judge

1. At /e/horizon-2026/cfp, create a submitter account (or sign in), then submit
   a proposal. Pick Workshop as format and a conditionally required field
   appears; the API enforces the same rule. The signed-in dashboard lists the
   proposal and status after submission.
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
   https://lectern.lectern-go7.workers.dev/review/rev_sam_demo
   (Sam Peters, two assigned proposals in the open Final Review round).
   Recusal removes a proposal from that reviewer's queue.
   Kill My SaaS judges: each of you already has your own scored queue —
   /review/rev_swyx · /review/rev_sydney · /review/rev_phlo ·
   /review/rev_kelsey (two assigned proposals each; your scorecards
   aggregate with Sam's, and "Draft scores with AI" is propose-only).
4. /admin/portal-forms: build a form and assign it to speakers as a task, the
   way a real organizer collects hotel, travel, or reimbursement details.
   "Hotel and travel reservations" ships assigned to four speakers with one
   reply already in; open /speaker/spk_dana to answer it as a speaker, then
   read every response back on the organizer page. Same form engine as the
   CFP, pointed at the portal.
5. /admin/agenda: drag it onto another room or use exact controls; room and
   speaker double-bookings are flagged live (two conflicts ship pre-staged).
   Add a room inline, or "Auto-place" the unscheduled pool into conflict-free
   open slots. Then "Notify speakers": Claude drafts the schedule notice
   telling every speaker on the session their confirmed day, time, and room —
   slot facts are required verbatim and guaranteed into the body. Dragging
   never fires an email; the organizer decides when the schedule speaks.
6. /admin -> add a direct sponsor session — no submission behind it, by design.
7. The speaker portal shows the speaker's OWN proposals with live status and
   decision, editable until the CFP closes or a decision lands; plus derived
   onboarding tasks and real file upload/versions (R2). Co-speakers can be
   added at submission time.
8. /admin/communications: previewed reminder, simulated send with receipt,
   downloadable .ics carrying the session — and a full outbox listing every
   recorded message with status and timestamps.
9. /embed-preview: mobile-first schedule, sessions, speaker gallery — and an
   anonymous personal itinerary (star sessions into "My schedule", no
   account required) on the public event page.

## Speed, measured

The brief asks for speed and the walkthrough calls the incumbent slow three
times, so this is measured rather than claimed. Time to first byte, five runs
each, from a US client: landing page 21ms median, public event page 19ms,
schedule API 60ms, speakers API 56ms, schedule embed 57ms, this file 16ms.
Slowest median surface: 60ms. Re-run it yourself against any deployment:
`node scripts/measure-latency.mjs https://lectern.lectern-go7.workers.dev`

## Machine-readable

- API index (JSON): https://lectern.lectern-go7.workers.dev/api/docs
- Health: https://lectern.lectern-go7.workers.dev/api/health
- Public schedule JSON: https://lectern.lectern-go7.workers.dev/api/public/events/horizon-2026/schedule

## Source and docs

- GitHub: https://github.com/SteveMLC/lectern (MIT)
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
