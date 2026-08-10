# AI usage and reimbursement evidence

This directory is the append-only audit trail for AI-assisted SpeakerOps work. It exists because the Kill My SaaS brief permits up to $500 of token-cost reimbursement for a valid submission, including qualifying subscription usage, subject to organizer review and proof.

Authoritative rule: [Kill My SaaS 1 brief](https://docs.google.com/document/d/1rBHJtiNKHv4i43tdf2Rm0sDEYuIcajhmAPoBKR_Az-A/).

## What is committed

- `ledger.jsonl` — one immutable JSON object per measured work period. It records the agent, model, token categories, artifacts/commits, sanitized session id, raw-evidence SHA-256, and line count.
- `pricing.json` — dated official list-price snapshots used only to gauge API-equivalent workload cost.
- `REPORT.md` — the current human-readable reimbursement summary.

The ledger distinguishes three things that must not be conflated:

1. **Provider-reported tokens** — counters copied from the local provider session log.
2. **API-equivalent estimate** — those counters multiplied by a pinned public list price. This is a workload gauge, not proof of what a subscription billed.
3. **Actual billed spend** — the amount on an invoice or subscription receipt. This is the number to use in a reimbursement claim.

## Log each AI work session

At the end of a Fable/Opus, Codex, or Walt/OpenClaw work period, snapshot its local JSONL log:

```bash
pnpm usage:snapshot -- \
  --format codex \
  --file /private/path/to/rollout.jsonl \
  --actor "Codex engineering task" \
  --surface "Codex Desktop" \
  --category engineering_qa_release \
  --description "What changed and why" \
  --commits abc1234,def5678 \
  --artifacts src/worker,src/web
```

Formats are `codex`, `claude`, and `openclaw`. For a mixed Claude session, the command produces a separate entry for every model. Re-running a growing session records only the delta from its previous cumulative snapshot. Use `--dry-run` to inspect the entry without appending it. OpenClaw logs that contain unrelated work can be bounded with `--since` and `--until` ISO timestamps.

Then run:

```bash
pnpm usage:check
pnpm usage:summary
```

`pnpm verify` includes ledger validation, so duplicate ids, broken evidence hashes, negative counters, and stale cost calculations fail CI.

## Claim checklist

- Keep the raw JSONL files and provider/account exports in `usage/private/`; git ignores their contents.
- Add the matching invoice or subscription receipt to `usage/private/` and update `actualBilledUsd` plus `receiptStatus` in the corresponding ledger entry.
- Keep plan-level charges separate from the API-equivalent estimate. Do not claim both for the same usage.
- Preserve relevant commit hashes and artifact paths in each entry.
- Run `pnpm usage:check` and attach the ledger/report plus requested private evidence when the organizer asks.
