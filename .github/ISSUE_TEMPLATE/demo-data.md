---
name: Demo data
about: Create or improve the conference data the demo runs on
title: "[demo-data] "
labels: ["demo-data", "liam"]
---

## What to add or change

<!-- e.g. "Three more submissions in the Reliability track" or "A speaker who submitted twice and got rejected both times" -->

## Which story does it serve?

<!-- Every record should earn its place. Which demo beat does this support?
     Examples: a conflict the organizer fixes on stage, a speaker who owes slides,
     a near-duplicate pair the committee has to choose between. -->

## Files

- [ ] `demo-data/liam-conference.event.json`
- [ ] `demo-data/liam-conference.speakers.json`
- [ ] `demo-data/liam-conference.submissions.json`
- [ ] `demo-data/liam-conference.storylines.md` (note the story behind anything deliberately broken)

## Done when

- [ ] `pnpm demo:check` passes
- [ ] Loaded via `/demo` and it looks right in the app
- [ ] Anything deliberately awkward has a `storyNote` so nobody "fixes" it later
