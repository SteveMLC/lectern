# Groundwork 2026 — demo storylines

Owner: Liam. This file is the narrative behind the data. Nothing here is loaded into the app — it is the script the demo follows and the reason each record exists.

Rule of thumb: **every awkward thing in the data is deliberate.** If a judge finds a conflict, a missing headshot, or a rejected talk, it should look like a real conference having a normal week, not like broken test data.

---

## The conference

**Groundwork 2026** — two days in Portland for people who maintain things. Legacy migrations, on-call that does not burn people out, tests for code nobody wants to touch. Deliberately unglamorous, which makes the demo data feel like a real event rather than a startup fantasy.

- 4 tracks: Legacy & Migration, Reliability & Operations, Craft & Codebases, Teams & Process
- 3 rooms: The Foundry (350, recorded), The Annex (120), Workshop Room (60)
- 12 speakers, 20 submissions, 9 accepted, 1 invited keynote

---

## The five storylines

### 1. The double-booked speaker

**Rosa Delgado is in two places at 10:30 on day one.**

She is the primary speaker on *Eleven Years Off COBOL* (10:00–10:45, The Foundry) and a co-speaker on *You Cannot Grep Your Way Out of This* (10:30–11:15, The Annex). Fifteen minutes of overlap.

This is the conflict the organizer fixes live on stage. It is realistic because it comes from a co-speaker credit — the kind of thing a spreadsheet never catches.

### 2. The room double-booking

**The Annex is booked twice at 11:00 on day one.**

*You Cannot Grep Your Way Out of This* runs 10:30–11:15 and *On-Call Without the Burnout Tax* starts at 11:00. Fifteen minutes of overlap, different speakers, same room.

Two conflicts of different kinds on the same afternoon proves the engine is checking more than one thing.

### 3. The near-duplicate talks

**Two people submitted the same talk.**

*The Strangler Fig Pattern, Honestly Assessed* (Priyanka Rao) and *Incremental Rewrites: What the Diagrams Leave Out* (Sofia Marchetti) make the same argument — the proxy layer becomes permanent, running two systems has a cost, here is how to know when to stop. Both are under review.

The committee has to pick one. This is where review tooling earns its keep, and where an optional AI assist can flag the pair without making the decision.

### 4. The speakers who owe you things

Five accepted speakers have outstanding onboarding tasks:

| Speaker | Outstanding | Why it matters |
| --- | --- | --- |
| Kwame Asante | Headshot | Blocks the speaker gallery |
| Hana Kobayashi | Slides, release | Worst offender on the dashboard |
| Dmitri Volkov | Bio (submitted empty) | Public site has a hole |
| Sean Brennan | Recording release | **His talk is in The Foundry, the recorded room — this one actually blocks something** |
| Tobias Lindqvist | Headshot, slides | The classic late-slides speaker, two weeks out |

Sean's is the good one to demo. A missing release on an unrecorded talk is admin. A missing release on a recorded talk is a problem with a deadline.

### 5. The sponsor keynote that never applied

**Gwen Okonkwo is opening the conference and never submitted anything.**

Sable Payments is the headline sponsor. Her keynote was added directly by the organizer — no CFP, no review round, straight onto the agenda.

This is the single most important record in the dataset. It proves submissions and sessions are different things, which is exactly what the briefing video describes and what a naive clone gets wrong.

---

## Known gap: the capacity mismatch

The keynote is deliberately scheduled into the **Workshop Room (60 seats)** — a 350-person keynote in the smallest room in the building.

The conflict engine does **not** currently detect this. It checks room double-booking and speaker double-booking only. The data is staged and waiting; capacity checking is a Lane B item.

Do not "fix" this in the data. It is a real organizer mistake and it is here on purpose. Either the engine learns to catch it or we cut it — but the scenario stays.

---

## Demo beats

1. Open Groundwork. 20 submissions, 4 tracks, CFP still open.
2. Submit a proposal from the public form in a second tab. Watch it land.
3. Review: two near-duplicate strangler-fig talks side by side. Pick one.
4. Accept a batch. Watch sessions appear with their lineage kept.
5. Point at the sponsor keynote: never a submission, still on the schedule.
6. Agenda: Rosa is double-booked and The Annex is double-booked. Fix both live.
7. Speaker portal as Hana: two tasks outstanding, updates her bio.
8. Comms: reminder drafts for the five speakers who owe things, calendar invite with a real `.ics`.
9. Dashboard: outstanding tasks burning down.
10. Embeds: schedule and speaker gallery, then at phone width.

---

## QA notes

Add findings here as you use the app. Format: what you did, what you expected, what happened.

- _(add notes here)_
