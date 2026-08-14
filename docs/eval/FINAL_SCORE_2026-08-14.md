# Lectern vs the organizer's eval kit — post-extension run

Run: sbek (the organizer's published eval kit), agent claude-sonnet-5,
judge claude-opus-5, 100 turns per scenario, against the live deployment
https://lectern.lectern-go7.workers.dev on 2026-08-14 (run
`2026-08-14T21-25-54`).

## Result

**95.0% over 100% coverage.**

| Area | Score |
|---|---|
| Call for Papers | **100%** |
| AI & Agenda | **100%** |
| Abstract Management | 96.4% |
| Speaker Management | 95.5% |
| Public Widgets | 92.9% |
| Content Management | 85.5% |

The raw automated pass scored 93.4% over 98.1% coverage; the 17 items the
agent could only half-verify were then checked by hand against production
(API responses, outbox receipts, downloaded files, a live browser) and
recorded in `manual-results.json` with the evidence beside each verdict.
One item stayed partial on honesty grounds: organizer-side speaker editing
covers the bio but not the headshot photo, which only the speaker replaces
through their portal.

## Against the recorded 2026-08-12 run

The submission-time record (`FINAL_SCORE_2026-08-12.md`) is 93.5%. That run's
raw automated score was 81.1% over 78.8% coverage. Between the two runs the
organizer extended the deadline and we closed every gap the brief's own
captures name: Portal Forms, multiple submission forms per event, the
post-submission behaviour the customer annotated "make sure this works",
agenda Week and Conflicts views, submission reference codes, two-tier
submission caps, cross-field character limits, draft close-date reminders,
admin notifications, locked fields, and question reordering.

Raw automated: **81.1% → 93.4%** (+12.3). Finalized: **93.5% → 95.0%**.

Both records stand as run; neither was re-rolled. The earlier file preserves
its own caveats unchanged.

## Reproduce it

```
cd <sbek-clone>
pnpm run eval -- --url https://lectern.lectern-go7.workers.dev \
  --agent-model claude-sonnet-5 --judge-model claude-opus-5 --max-turns 100
pnpm run finalize -- --run runs/<timestamp>
```
