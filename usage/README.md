# AI usage and reimbursement evidence

This directory is the append-only audit trail for AI-assisted SpeakerOps work. It exists because the Kill My SaaS brief permits up to $500 of token-cost reimbursement for a valid submission, including qualifying subscription usage, subject to organizer review and proof.

Authoritative rule: [Kill My SaaS 1 brief](https://docs.google.com/document/d/1rBHJtiNKHv4i43tdf2Rm0sDEYuIcajhmAPoBKR_Az-A/).

## What is committed

- `ledger.jsonl` — one immutable JSON object per measured work period. It records the agent, model, token categories, artifacts/commits, sanitized session id, raw-evidence SHA-256, and line count.
- `receipts.jsonl` — append-only receipt allocations. Each record stores a private receipt's digest, byte size, billing period, actual amount, and the usage entries it covers; the receipt itself is never committed.
- `pricing.json` — dated official list-price snapshots used only to gauge API-equivalent workload cost.
- `REPORT.md` — the current human-readable reimbursement summary.

The ledger distinguishes three things that must not be conflated:

1. **Provider-reported tokens** — counters copied from the local provider session log.
2. **API-equivalent estimate** — those counters multiplied by a pinned public list price. This is a workload gauge, not proof of what a subscription billed.
3. **Actual billed spend** — the amount on an invoice or subscription receipt. This is the number to use in a reimbursement claim.

## Automatic logging

There are two automatic capture paths. Development agents are imported from their provider session logs by the pre-commit hook. AI calls made by the deployed SpeakerOps app are written to D1 before the API response is returned, using the provider request id and provider-reported input/cache/output counters. The runtime table deliberately never stores prompts, internal reviewer reasoning, or generated email text.

Export any new production events into the same append-only ledger with:

```bash
SPEAKEROPS_ORGANIZER_PASSCODE=... pnpm usage:runtime
```

The command fetches the organizer-only `/api/admin/ai-usage` counter feed, saves its sanitized raw response in ignored `usage/private/`, deduplicates by provider request id, selects pricing from `pricing.json`, appends only unseen events, and regenerates `REPORT.md`. `pnpm usage:runtime -- --check` is read-only and fails when a production event has not yet reached the ledger; the submission preflight runs this check.

Copy the safe template to the gitignored local configuration and add the stable session IDs used for this repository:

```bash
cp usage/sources.example.json usage/private/sources.json
pnpm usage:install-hooks
pnpm usage:sync -- --dry-run
```

The logger finds those sessions below the standard Codex, Claude, or OpenClaw directories, so dated folders and machine paths are not committed or hardcoded. For OpenClaw it prefers the live session and falls back to the newest reset log after rotation. An explicit private `file` or `searchRoot` remains available for nonstandard installations.

The tracked `.githooks/pre-commit` hook runs `usage:sync` before every commit, appends only provider-counter deltas, regenerates the tamper-evident report, stages both files, and validates them. Source configuration and raw logs stay in `usage/private/` and never enter git. Staged file paths are attached automatically as artifact provenance.

Provider JSONL is streamed and hashed line by line, retaining only the record types needed for token accounting. Very large, long-lived Claude/Fable/Opus logs therefore keep the same full-file SHA-256 and line-count evidence without crossing the JavaScript string limit or weakening the commit gate. Missing optional sources may be absent; a configured source that exists but cannot be parsed still fails closed.

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

## Record actual billed spend

Explicitly copy the AI provider invoice or subscription receipt into `usage/private/`, then append a sanitized allocation record:

```bash
pnpm usage:receipt -- \
  --file usage/private/openai-august-receipt.pdf \
  --provider openai \
  --label "Codex subscription — August 2026" \
  --amount 200 \
  --period-start 2026-08-01T00:00:00Z \
  --period-end 2026-08-31T23:59:59Z
```

By default the command covers all uncovered entries from that provider whose work period overlaps the billing period. Use `--covers usage-id-1,usage-id-2` only when a receipt needs a narrower allocation. The command hashes the raw file, appends `receipts.jsonl`, and regenerates the report. It rejects duplicate receipt files, unknown entries, provider mismatches, and double-covered work. Use `--dry-run` to inspect the allocation first.

The command fails closed for files outside `usage/private/`, including symlinks that resolve outside it. This prevents broad local searches or unrelated billing documents from entering the reimbursement workflow accidentally.

Never revise an earlier usage entry to add billed spend. Corrections and receipts are new immutable records, preserving the original provider evidence and git history.

## Claim checklist

- Keep the raw JSONL files and provider/account exports in `usage/private/`; git ignores their contents.
- Add the matching invoice or subscription receipt to `usage/private/` and record it with `pnpm usage:receipt`; do not edit an existing ledger entry.
- Keep plan-level charges separate from the API-equivalent estimate. Do not claim both for the same usage.
- Preserve relevant commit hashes and artifact paths in each entry.
- Run `pnpm usage:check` and attach the ledger/report plus requested private evidence when the organizer asks.
