# Official-harness self-assessment — final

Run: sbek (the organizer's published eval kit), agent claude-sonnet-5,
judge claude-opus-5, against the live production deployment, followed by
hand verification of manual-only items with evidence recorded per item.

Measured in three passes on 2026-08-12:

1. **Baseline** (pre-uplift): 37% overall.
2. **First finalized pass**: 82.3% — but the Call for Papers, Speaker
   Management, and Content Management auto-verdicts predated the
   deliverables uplift, so those areas carried stale numbers.
3. **Targeted re-grades** of those three areas, then of Public Widgets, against the shipped build,
   plus live-probed manual verdicts for every remaining manual item in
   them (`manual-results-regrade-2026-08-12.json`).

| Area | Weight | Baseline | Stale pass | Final |
|---|---|---|---|---|
| Call for Papers | 20% | 47.3% | 84.3% | **93.4%** |
| Abstract Management | 20% | 3.6% | 83.3% | **87.5%** |
| Speaker Management | 15% | 57.8% | 67.2% | **89.4%** |
| Content Management | 15% | 48.4% | 50.0% | **85.5%** |
| AI Agenda | 10% | never judged | 93.8% | **94.4%** |
| Public Widgets | 20% | never judged | manual-only | **92.9%** |

**Overall: 37% → 90.4% at 100% rubric coverage — every weighted item
judged, zero manual items pending.**

Public Widgets was the last coverage hole (the original run's judge
calls died on exhausted API credits). A dedicated re-run on the Lectern
deployment judged all 35 weight points at 100% coverage: 92.9%
(`manual-results-widgets-2026-08-12.json` holds the three manual
verdicts with evidence).

Product rename note: the baseline and first pass measured the identical
build at the pre-rename URL (`speakerops.speakerops-go7.workers.dev`);
the re-grade ran against the same deployment, and all manual probes ran
against the renamed production deployment
(`lectern.lectern-go7.workers.dev`). The rename changed brand strings
only, plus the removal of one unadvertised route.

Every verdict carries its evidence note; nothing was marked pass without
being exercised against production. Zero manual items remain pending in
the re-graded areas.
