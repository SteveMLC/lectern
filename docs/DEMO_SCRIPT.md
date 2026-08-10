# Demo recording script — ~3 minutes

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
> speaker's company, their bio, and their form answers right on the card. I've got what
> I need to judge it without leaving."

Click **Approve** on the new proposal. Point at the toast.
> "Approving doesn't just flip a status — it creates exactly one session, idempotently,
> with lineage back to the submission. The queue just dropped by one."

**1:35 — Agenda**
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

**2:05 — Speaker portal (Speakers → Open speaker portal on the new speaker)**
> "The speaker I just accepted already has an onboarding checklist — derived the moment
> they joined the program."

Complete one task. Upload any small image as a headshot.
> "That's a real file in R2, not a URL field."

**2:25 — Communications**
Pick the accepted speaker, show the preview.
> "Reminders merge their actual outstanding tasks. Sends are simulated by default with a
> receipt — flip one env var for real email — and the calendar invite is a real .ics."

Download the .ics, show it in the downloads shelf.

**2:40 — Embeds (/embed-preview)**
> "Schedule, sessions, speaker gallery — iframe-ready for the event site, mobile-first."

Narrow the window briefly.

**2:50 — /demo, then close**
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
