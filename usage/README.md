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

## Automatic logging

Copy the safe template to the gitignored local configuration and add the stable session IDs used for this repository:

```bash
cp usage/sources.example.json usage/private/sources.json
pnpm usage:install-hooks
pnpm usage:sync -- --dry-run
```

The logger finds those sessions below the standard Codex, Claude, or OpenClaw directories, so dated folders and machine paths are not committed or hardcoded. For OpenClaw it prefers the live session and falls back to the newest reset log after rotation. An explicit private `file` or `searchRoot` remains available for nonstandard installations.

The tracked `.githooks/pre-commit` hook runs `usage:sync` before every commit, appends only provider-counter deltas, regenerates the tamper-evident report, stages both files, and validates them. Source configuration and raw logs stay in `usage/private/` and never enter git. Staged file paths are attached automatically as artifact provenance.

Model pricing is configuration-driven: the logger selects the newest `pricing.json` record whose provider/model matches the session and whose effective date is not later than the usage. Supporting a new model or price change requires a dated pricing record, not a code edit.

Use `AI_USAGE_SKIP=1 git commit ...` only for an emergency when the provider log is unavailable; run `pnpm usage:sync` before the next commit to close the gap.

## Manual snapshot

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

For an ad-hoc or historical source, use `usage:snapshot` directly. Then run:

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
