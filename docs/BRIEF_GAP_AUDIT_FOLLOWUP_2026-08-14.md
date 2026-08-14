# Followup: every screen in the brief, control by control

The first audit (`BRIEF_GAP_AUDIT_2026-08-14.md`) found the missing section.
This one goes screen by screen through the organizer's annotated Sessionboard
captures and the walkthrough transcript, and records the controls we do not
have — including the three the customer annotated by hand.

## The customer's own stickers

The organizer wrote directly on the captures. These are the strongest signal
in the entire brief, stronger than the prose.

| Sticker | Points at | Us |
|---|---|---|
| **"kinda impt"** | Submission form **Close Date** — "form and submissions will close after specified date", "set a close date to enable draft reminder emails" | **Have it.** Close date, and both lock reasons (closed vs decided) are unit-tested. Draft reminder emails on the close date: not built. |
| **"make sure this works"** | **After submission**: "Auto-redirect to speaker portal — after 10 seconds on the confirmation page", a customisable success message, and a "submit another session" link back to the form | **Partial.** We show a confirmation with a reference id and a link to the portal. No auto-redirect, no submit-another link. |
| **"nice to have"** | **Notifications**: which admins are emailed on new and on updated submissions | Not built. Explicitly low priority. |

## Submission form builder, step by step

Their wizard: Submission Setup → Welcome Screen → Abstract Information →
Participant Information → Payments & Fees → Form Settings → Notifications.

| Control | Us |
|---|---|
| Submission type: **Abstracts vs Sessions**, Participants step toggle | Not modelled — every form is a CFP |
| Welcome screen: message and terms | Have (welcome text) |
| Abstract Information: section title, page heading (65 char cap), rich-text description, ordered questions | Have fields and help text; description is plain text, no ordering UI, no per-field char caps |
| **Locked fields** (Title cannot be removed) | Not modelled |
| **Drag-to-reorder** questions | Not built (sort order is fixed at creation) |
| Payments & fees | **Skip** — "we don't really care about payments" |
| Form Settings: close date | Have |
| Form Settings: **submission limit per submitter** ("includes saved drafts and submitted sessions"; event-level default "Event max: 3") | Not built |
| Form Settings: allow multiple draft submissions | Drafts exist; the multiple-draft cap does not |
| Form Settings: **cross-field character limits** ("cap the combined length of several text fields, e.g. a printed program block, with a live combined counter") | Not built |
| Notifications: admin recipients for new/updated submissions | Not built ("nice to have") |
| **Multiple submission forms per event**, each with open/closed state, own close date, version tag, submission and draft counts | We model exactly one CFP per event |

## Agenda

Their view tabs: **List · Day · Week · Month · Rooms · Conflicts**, plus Saved
Views, Columns, Sort, Filter, Drafts, Add Session.

We have a room board, a list projection, and day/track/room filters — so Day
and Rooms are reachable as filters, but **Week and Month do not exist**, and
conflicts are banners rather than **a dedicated Conflicts view**. A conflicts
tab is cheap for us: the engine already computes them.

## Speaker portal

Theirs is tabbed — **Home · Submissions · Profile · Tasks** — with a Home
dashboard of My Submissions, My Profile, and Tasks split into **Submission
Tasks** and **My Tasks**.

Two things worth taking:
1. **Human-readable submission codes.** Their submissions read `SESS-3`,
   `SESS-4`. Ours read `sub_9hjfxjzjrnpb`. A short per-event code is what an
   organizer says out loud on a call.
2. **Task scoping.** "Submission Tasks" versus "My Tasks" is the same
   session-scoped versus person-scoped split their admin Tasks page shows
   (Contact / Group / Submission). Ours are person-scoped only.

## Ranked repair list, and what landed

1. **Post-submission behaviour** — *the customer wrote "make sure this works"*.
   **Done.** Ten-second countdown into the speaker portal with "Go now" and a
   sticky "Stay on this page", plus "Submit another proposal" that resets the
   form and strips the draft token. A signed-in submitter keeps their
   read-only name and email through the reset, which a blank wipe would have
   stranded.
2. **Portal Forms** — the missing brief section. Backend **done** and verified
   end to end; organizer builder and speaker fill-in in flight.
3. **Agenda Week and Conflicts views** — **done.** Week gives a column per
   event day; Conflicts groups room and speaker double-bookings with the
   overlapping window and a "Show on board" jump. Both back onto pure,
   timezone-correct helpers with tests.
4. **Human-readable submission codes** — **done.** `SUB-11` assigned inside
   the insert so concurrent submissions cannot collide, backfilled for
   existing rows, and shown on the confirmation, the review cards, and the
   CSV export.
5. **Speed** — not a gap but the loudest complaint on the tape. **Measured**:
   slowest median surface 60ms, pages at 19-21ms, with
   `scripts/measure-latency.mjs` committed so anyone can re-run it.
6. **Per-form submission limits** — **done.** Two-tier, as their control
   shows: a form-level cap counting drafts, then the event max when the form
   sets none. Enforced on the API, not just the form.
7. **Cross-field character limits** — **done.** "Printed programme block"
   rules sum named fields; the API refuses an over-length submission with the
   exact overage.
8. **Multiple submission forms per event** — **done.** The primary form keeps
   /cfp; every other call runs at /e/:slug/cfp/:formId with its own
   questions, window, drafts, and capacity. Admin gains a Submission forms
   page; Reviews names the source call. Seeded: "Lightning talks — late
   call".
9. **Draft reminder emails** — **done.** One receipted reminder per draft
   when the close date is within seven days, on the existing cron.
10. **Admin notification recipients** — **done.** Receipted mail per
    configured admin on each new submission, naming title, code, submitter.
11. **Locked fields and drag-to-reorder** — **done.** Core questions badge
    Locked and cannot be removed or shadowed; custom questions reorder by
    accessible Move up/down buttons and drag, persisted and reflected on the
    public form.

## Not gaps, confirmed

Accelevents (organizer waived it in Discord), payments, multi-language, and AI
workflows ("I don't care about the AI workflow thing" — ours stays optional).
