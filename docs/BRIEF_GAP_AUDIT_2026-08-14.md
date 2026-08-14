# Brief gap audit — every source, read end to end

Written 2026-08-14, after the submission, against **every** artefact the
organizer published: the full brief text, the "(IMPORTANT)" 9:55 walkthrough
video (transcript pulled from its captions), the ten annotated Sessionboard
screenshot sections, and the organizer's numbered Q&A in Discord.

We had built against the brief's prose plus the organizer's published eval
kit. The kit is a rubric, not a spec — it never tests the sections below.

## Sources read

| Source | Status |
|---|---|
| Brief prose, 9 primary features | read |
| Walkthrough video (youtu.be/vUuK4Knl7oc, 9:55) | transcript read in full; media is DRM/SABR-gated so frames were unavailable |
| 10 screenshot sections (42 images, red-arrow markups) | read visually |
| Organizer Q&A in Discord (9 numbered answers) | read |

## Verified NOT a gap

- **Accelevents integration.** Listed as a primary feature in the brief, but
  the organizer settled it in Discord: *"skip accelevents its fine, like i
  said its not required."* Our llms.txt already says exactly this, and the
  claim is now sourced.
- **Payments/fees** in the form builder — *"we don't really care about
  payments, you can skip this one if you're cloning it."*
- **Multi-language** — *"we only care about English."*
- **AI workflows** — *"I don't care about the AI workflow thing."* Ours is
  optional seasoning, which matches.

## Gaps found

### 1. Portal Forms — a whole labeled section we do not have
The brief has a section titled **"Portal > Forms — For speakers to fill out a
form in a Task."** Sessionboard: *"Create forms that can be assigned to your
portals to collect information"*, with Contact / Group / Submission form
types and a Create Form flow (Form Setup → Form Questions → Settings).
The Q&A names the real uses: **hotel stay requirement form, flight
reimbursement form**, plus finalize talk description, finalize bio/photos,
announce participation, invite colleagues with speaker discount.

We have the whole form engine — fields, conditional rules, validation — wired
to exactly one consumer, the CFP. A speaker can tick a task or upload a file,
but cannot fill out a form.

### 2. Multiple submission forms per event
Their screenshot lists three live forms side by side, each with its own open/
closed state, close date, version tag, and submission/draft counts. We model a
single CFP form per event.

### 3. Submission form builder depth
Their wizard: Submission Setup (**Abstracts vs Sessions**, Participants step
toggle) → Welcome Screen → Abstract Information → Participant Information →
Payments *(skip)* → **Form Settings (deadlines, limits, success page)** →
**Notifications (admin alerts, email templates)**. We cover fields,
conditional rules, close date, welcome/thank-you copy, speaker cap. Missing:
form type choice, per-form submission limits, reminder email, admin alerts.

### 4. Task scoping: Contact vs Session vs Group
Their tasks tab: All / Contact / Group / Submission, e.g. "Hotel and Travel
Reservations" (Contact) and "Presentation Upload" (Session). Ours are
speaker-scoped only.

### 5. Calendar invites are publications, not invitations
Primary feature: invites "delivered directly to each speaker's own calendar
(Gmail, Outlook, iCal)". We emit `METHOD:PUBLISH`, which downloads. A real
invitation needs `METHOD:REQUEST` with ORGANIZER and ATTENDEE so it lands with
Accept/Decline.

### 6. Multi-track submissions
Q&A: *"talks are submitted to one or more tracks, and reviewers review one or
more tracks."* We allow one track per submission and assign reviewers per
submission — finer-grained, but not the literal ask.

### 7. Week view
Brief: "viewable by list, day, week, track, or room". We have a room board, a
list projection, and day/track/room filters. No week view — of little use for
a two-day event, and llms.txt already describes only what exists.

## Signal worth acting on, not a feature

The customer complains about Sessionboard's speed three times on camera —
*"it's kind of slow"*, *"this slowness is part of why I think you guys can
probably do a better job"*, *"oh my god, this is so slow"* — and the brief
gives bonus points for it. Our edge deployment is the answer; it deserves
measured proof rather than a claim.

## Order of work

1. Portal Forms (the missing section)
2. Calendar invites as real invitations
3. Multiple submission forms per event
4. Task scoping to sessions
5. Multi-track, week view — only if the above land clean
