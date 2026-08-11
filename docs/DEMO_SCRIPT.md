# Demo recording script — ~3.5 minutes

One take, screen + voice, no slides. Chrome at a normal window size, bookmarks bar hidden.
The through-line: **the whole lifecycle, live, with no login** — say what hurts for organizers,
then show the product removing it. Never name competitors.

## Before you hit record

```bash
cd workspace/repos/speakerops
SPEAKEROPS_ORGANIZER_PASSCODE=speakerops-judge-2026 pnpm demo:reset:remote
# Fails before mutation unless Airtable can reconcile, then restores the pristine seed and strict 6/6 proof.
```

- Open tabs in order, left to right: ①`https://speakerops.speakerops-go7.workers.dev` ②an
  incognito window (proves no-login), ③nothing else.
- Do NOT rotate secrets or deploy within 10 minutes of recording (edge propagation).
- Passcode you will type on camera: `speakerops-judge-2026` — it is deliberately public.

## The walk

**0:00 — Landing (tab 1)**
> "This is SpeakerOps — the program side of Sessionboard, open source, running on
> Cloudflare Workers for about zero dollars. Everything you're about to see is the live
> deployed site, and there is no login — you can click along right now."

Click **Submit a talk to the demo event**.

**0:20 — Public CFP (switch to the incognito tab, paste the CFP URL)**
> "A speaker lands on the call for papers. No account, no sign-in — the friction that
> loses you speakers is gone."

Fill: name, email, a real-sounding title and abstract. Pick track. Then:
> "Watch the format field — I pick Workshop…"

Switch format to **Workshop** — the workshop-length field appears.
> "…and a required field appears. Conditional logic, enforced by the browser *and* the
> API — a hidden field is never demanded, a visible one is never skippable."

Set it back to Talk, submit. Thank-you screen.

**0:55 — Organizer console (tab 1 → /admin)**
Type the passcode on camera.
> "The organizer side. One passcode for the demo — judges: it's in the README."

Dashboard: point at **"8 need decision →"**.
> "The dashboard tells me my actual job. Click it…"

**1:10 — Reviews**
> "…and I'm in the decision queue. My new proposal is already here — with the
> speaker's company, their bio, their form answers, and the committee's earlier notes
> right on the card. I've got what I need to judge it without leaving."

Click **Approve** on the new proposal. The panel opens with the program title
pre-filled — trim it (e.g. drop a subtitle) and note the line that appears:
> "Titles get edited — every program does it. I retitle it for the program here, and the
> speaker's original submission still says what they pitched."

Then type the note: `strong practical angle — main stage material`. Click **Draft acceptance email**.
> "Approving isn't just a status flip. Claude drafts the acceptance around my note —
> and look: the speaker's portal link and the exact onboarding checklist the system is
> about to create, right in the email. The link is guaranteed, even if the model forgot it."

Click **Send (simulated) & approve**. Point at the toast.
> "One session created, idempotently, with lineage back to the submission — and my note
> is saved as a committee note, so the *why* outlives the call."

**1:30 — AI decision feedback (the standout beat — slow down here)**
Click **Deny** on a weaker proposal. The reasoning box opens.
> "Now the part every organizer dreads — saying no. I don't get a form letter. I write
> why, bluntly, the way I'd say it in the committee room…"

Type on camera: `ran this topic last year; abstract has no real numbers; would love a workshop version instead`
Optionally point at the **Reviewing as** field:
> "Most conferences aren't run by a committee — one person calls it. So by default this is
> just me. But if I want a second voice, I type a name and their note stacks on the card
> instead of overwriting mine. A committee only when you need one — no plans to configure."

Click **Draft feedback email**. Wait the ~2 seconds. Point at the badge.
> "…and Claude turns my blunt notes into a thoughtful, specific email — the decision
> stays unmistakable, my reasons become feedback the speaker can actually use. I can
> edit every word. AI proposes, I approve, the system commits — nothing is ever
> auto-sent. And without an API key this degrades to an honest template, never an error."

Change one word to prove it's editable, then click **Send (simulated) & deny**.

**2:00 — Agenda**
> "The agenda knows things a spreadsheet never will."

Point at the red banner reading the two conflicts aloud, short:
> "A room double-booked in Main Hall, and Ada Okafor booked in two places at once —
> caught live, named in plain language."

Drag **Eval Pipelines That Do Not Lie** from Main Hall into Workshop Studio.
> "I can drag a session onto another room, and the move persists immediately. One of
> those conflicts disappears in front of us; exact room and time controls remain for
> keyboard, mobile, and precise editing."

Click **Add direct session**, create "Sponsor Keynote" with a speaker, place it.
> "Sponsor keynotes never went through the CFP — that's a first-class path, not a fake
> submission."

Click **Notify speakers →** on the session you just moved (lands in Communications,
prefilled). Click **Draft schedule notice**. Point at the slot line.
> "And the schedule doesn't move in silence — one click, and Claude drafts the email
> telling the speaker their exact new day, time, and room. The slot facts are required
> verbatim — the model is never allowed to restate a time in its own words. Dragging
> never fires an email; I decide when the schedule speaks."

Click **Send (simulated) to 1 speaker**.

**2:30 — Speaker portal (Speakers → Open speaker portal on the new speaker)**
> "The speaker I just accepted already has an onboarding checklist — derived the moment
> they joined the program."

Complete one task. Upload any small image as a headshot.
> "That's a real file in R2, not a URL field."

**2:50 — Communications**
Pick the accepted speaker, show the preview.
> "Reminders merge their actual outstanding tasks. Sends are deliberately simulated with
> a persisted receipt, and the calendar invite is a real .ics."

Download the .ics, show it in the downloads shelf.

**3:05 — Embeds (/embed-preview)**
> "Schedule, sessions, speaker gallery — iframe-ready for the event site, mobile-first."

Narrow the window briefly.

**3:15 — /demo, then close**
> "Judges will break things, so the demo expects it: this second, hand-authored
> conference loads in one click and resets to its files in one click. The repo is MIT,
> the API is public and documented, there's an llms.txt if your agent is doing the
> judging — and the Airtable mirror is wired for teams who live there. SpeakerOps:
> the $40k workflow, without the $40k."

Stop recording.

## After recording

```bash
SPEAKEROPS_ORGANIZER_PASSCODE=speakerops-judge-2026 pnpm demo:reset:remote
# Returns prod to pristine and removes only duplicate app-owned Airtable rows.
```

Watch it back once at 1.5×: no dead air over 3 seconds, no console visible, passcode
typed correctly. Re-record rather than edit.

## Why this order

Public → decision → session → schedule → conflict → portal → comms → embed is the
organizer's actual lifecycle — the same uninterrupted chain the brief says a judge
must be able to complete. The video is that chain, narrated.
