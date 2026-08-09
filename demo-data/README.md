# demo-data

Hand-authored demo conferences. **You do not need to understand the app to work in this folder.** Edit JSON, run one command to check it, and your changes show up in the product.

## The files

| File | What it holds |
| --- | --- |
| `liam-conference.event.json` | The conference itself: name, dates, tracks, rooms, and invited sessions (sponsor keynotes that skip the CFP) |
| `liam-conference.speakers.json` | Speakers, bios, and which onboarding tasks each has finished |
| `liam-conference.submissions.json` | Talk proposals, their review status, and where accepted ones land on the schedule |
| `liam-conference.storylines.md` | The narrative — why each awkward record exists. Not loaded by the app; read by humans |

## Workflow

```bash
pnpm demo:check     # validates every file and prints what the data will produce
```

Then in the running app, open **`/demo`** and press **Load**. Your conference appears. Press **Reset** and it goes back to exactly what these files say — so you can break things freely.

## How records connect

Records point at each other with plain `key` strings, never database ids. A speaker with `"key": "rosa-delgado"` is referenced from a submission as `"speakers": ["rosa-delgado"]`. If you typo a key, `pnpm demo:check` tells you which one and where.

The first speaker listed on a submission is the primary; the rest are co-speakers.

## Staging the interesting cases

**A speaker double-booked.** Put the same speaker key on two submissions that are both `accepted` and give them overlapping `schedule` blocks.

**A room double-booked.** Two accepted submissions with overlapping times in the same `room`.

**A speaker who owes you something.** Leave a task out of `tasksComplete`. The four tasks are `bio`, `headshot`, `slides`, `release`. Anything you omit shows as outstanding on the dashboard.

**A sponsor keynote.** Add it to `invitedSessions` in the event file. It never becomes a submission and never goes through review — that is the point.

**Near-duplicate proposals.** Two submissions making the same argument, both `under_review`, different speakers.

## Times and dates

`day` is 1 for the first day of the conference, 2 for the second. `start` and `end` are 24-hour local times, e.g. `"14:30"`. The loader converts to UTC.

## Statuses

`draft`, `submitted`, `under_review`, `accepted`, `rejected`, `waitlisted`, `withdrawn`.

Only `accepted` submissions become schedulable sessions, so a `schedule` block only does something on an accepted submission.

## Starting your own conference

Copy the three JSON files, change the `key` and `slug` at the top of the event file, and update the `event` field in the other two to match. Keep the storylines file next to it — the narrative is as much the deliverable as the data.

## House rules

- Names and companies are invented. Use `.example` email domains — never a real person's address.
- Abstracts should read like a person wrote them. Two or three sentences with a real number in them beats a paragraph of adjectives.
- Anything deliberately broken gets a `storyNote` saying so, and a line in the storylines file. Otherwise the next person "fixes" it.
