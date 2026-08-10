# SpeakerOps — Tester's Guide

Written for Liam. No setup, no account, no code — everything runs in your browser.

**The app:** https://speakerops.speakerops-go7.workers.dev
**Organizer passcode** (it's public on purpose): `speakerops-judge-2026`

## What this thing is

Conferences get dozens of talk proposals. Someone has to collect them, judge them,
schedule the good ones into rooms without double-booking anyone, chase speakers for
headshots and slides, email decisions, and publish the schedule. Companies pay up to
$40,000/year for software that does this. We built an open-source version in a weekend
for a competition — judging is **Wednesday night**, so anything you find before then
counts double.

Your job: **use it like a real person and try to break it.** You are two people:
a *speaker* applying to talk, and an *organizer* running the event.

## The golden rule

You cannot damage anything. The demo is built to be broken: if data gets weird, open
`/demo` and press **Reset to files** — your Groundwork conference goes back to exactly
what your JSON files say. So be rough with it.

## The walkthrough — do these in order

### Part 1: You are a speaker (10 min)

1. Open the app → **Submit a talk to the demo event**. Make up a talk. Real-ish title
   and a few sentences of abstract.
2. **The trick to test:** set Format to **Workshop** — a "Preferred workshop length"
   field should appear *and be required*. Switch back to Talk — it should vanish.
   Try to submit a Workshop *without* answering it: the form must stop you.
3. Submit. You should get a thank-you screen.
4. Open the speaker portal: from the event page, or `/speaker/spk_ada` for Ada.
   - Edit the bio and save — does it stick after refresh?
   - Complete a task on the checklist — does the count drop?
   - **Upload a real image as a headshot** — then click it/download it. Same image?

### Part 2: You are the organizer (15 min)

5. Go to `/admin`, enter the passcode.
6. **Dashboard** — does "N need decision" match reality? Click it.
7. **Reviews** — find the talk you submitted in Part 1. Your name, your abstract, your
   answers should all be on the card. Some cards also show **Committee notes** — prior
   reviewer comments with an accept/reject lean.
8. **Approve it.** A note box opens — type something short ("great topic"), then
   **Draft acceptance email**. Check hard:
   - The email must contain the speaker's **portal link** and the **onboarding
     checklist** (headshot, bio, slides, AV check). Always — even weird notes.
   - **Send (simulated) & approve**: green toast, queue count drops by one.
   - Reload and switch the scope chip to **All**: your note should now sit on the
     card as a committee note. ("Approve without email" must also save the note.)
9. **The AI beat — test this hard.** Pick a weak proposal and click **Deny**. A box asks
   *why*. Write blunt reasons like you'd text them to a friend — "boring topic, no
   numbers, we did this last year." Click **Draft feedback email**.
   - A polite, specific email should appear in ~2 seconds, badge saying
     "Drafted by claude-sonnet-5 from your notes."
   - **Check: does it use YOUR reasons, without copying your rude wording?** It should
     never invent reasons you didn't give, and never sound mushy about the decision.
   - Edit a sentence, then **Send (simulated) & deny**. Status flips, no real email goes
     anywhere.
   - Try weird inputs: empty reasoning, one word, emoji, something in Spanish, 2,000
     characters of nonsense. It should always produce *something* sane or a clean error.
10. **Agenda** — the red banner should name two conflicts in plain English (a room
    double-booked, and Ada in two places at once). **Drag a session to another room** —
    does a conflict clear? Does it survive a page refresh? Add a direct "Sponsor
    Keynote" — it should appear without ever being a submission.
11. **Speakers** — open the portal of the speaker you approved in step 8. They should
    ALREADY have an onboarding checklist (that's automatic; it used to be a bug).
12. **Communications** — pick a speaker with missing tasks. The preview should list
    their actual missing items. Download the calendar invite (.ics) — does it open in
    a calendar app with the right session?
13. **Submissions** → **Export CSV** — open it in Numbers/Excel. Titles with commas and
    quotes should not break columns, and the **Committee notes** column should carry
    the notes you wrote in steps 8-9.

### Part 3: The public side (5 min)

14. `/embed-preview` — schedule, sessions, speaker gallery. Make the window phone-narrow.
    Still readable?
15. **Your conference:** `/demo` → **Load** Groundwork 2026 (your data!). Walk its event
    page — do your storylines read right in the real product? Rosa double-booked? The
    keynote in the tiny room? Then **Reset to files** and confirm it comes back clean.
16. On your phone, open the main site and the admin console. Anything unusable?

## What "broken" means (report all of these)

- Anything that errors, spins forever, or silently does nothing.
- Numbers that don't add up (dashboard says 7, list shows 6).
- The AI email inventing reasons you didn't write, leaking your blunt wording, or
  sounding unsure about the decision.
- Anything a stranger could do that they shouldn't (organizer pages without the
  passcode, uploading a 100MB file, weird text in forms ending up rendered as code).
- Confusing wording — if you had to read something twice, that's a finding.

## How to report

Best: GitHub issues at https://github.com/SteveMLC/speakerops/issues — templates exist
for **speaker-qa** (friction you hit), **bug** (broken things), and **ux-polish**
(bad wording). One issue per finding, with what you did → expected → actually happened.
Screenshots help a lot. If GitHub is annoying in the moment, a text to Dad with a
screenshot works — but issues get fixed faster because they're on the board.

## What NOT to worry about

Design taste (it's deliberately plain), the Resources admin page (hidden on purpose),
real emails (everything is simulated), and costs (the AI drafting costs a fraction of
a cent per click — test it as much as you want).
