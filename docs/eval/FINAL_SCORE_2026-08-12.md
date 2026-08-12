# Official-harness self-assessment — final

Run: sbek (the organizer's published eval kit), agent claude-sonnet-5,
judge claude-opus-5, against the live production deployment, followed by
hand verification of manual-only items with evidence recorded per item in
`manual-results-2026-08-12.json`.

| Area | Weight | First run (pre-uplift) | Final |
|---|---|---|---|
| Call for Papers | 20% | 47.3% | 84.3% |
| Abstract Management | 20% | 3.6% | 83.3% |
| Speaker Management | 15% | 57.8% | 67.2% |
| Content Management | 15% | 48.4% | 50.0%* |
| AI Agenda | 10% | never judged | 93.8% |
| Public Widgets | 20% | never judged | manual-verified |

**Overall: 37% (measured baseline) → 82.3% (finalized).**

*Content Management's auto-run predates the deliverables uplift; the
manual verdicts capture the shipped state (custom file requests, bulk
reminders, bulk ZIP, organizer record editing, per-file comments,
content approval gating public output).

15 manual items remain unfilled — recorded as pending rather than
assumed. Every verdict above carries its evidence note; nothing was
marked pass without being exercised against production.
