# AI usage reimbursement audit

Generated 2026-08-10 19:33 UTC by `pnpm usage:report`. Do not edit by hand — regenerate instead.

Ledger digest: `95d8b5c0bb585ed876024d182ba61acec26b7754c285073389c653fd3d73d297` (14 entries). `pnpm usage:check` fails if this file no longer matches the ledger.

## The three numbers, kept separate

1. **Provider-reported tokens** — counters copied from local provider session logs.
2. **API-equivalent estimate — $293.16** — those tokens at pinned public list prices ([pricing.json](pricing.json)). A workload gauge, not a bill.
3. **Actual billed spend — $0.00 evidenced so far** — the number a reimbursement claim uses. 13 entries await subscription receipts.

The [brief](https://docs.google.com/document/d/1rBHJtiNKHv4i43tdf2Rm0sDEYuIcajhmAPoBKR_Az-A/) allows a valid submission up to **$500** in token-cost reimbursement, including qualifying Codex Pro / Claude Max subscription usage, subject to proof and organizer review. The claim will be the receipt amounts, capped at $500 — never the API-equivalent gauge.

## Workload by model

| Provider / model | Entries | Calls | Input | Cache reads | Cache writes | Output | API-equivalent USD |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| anthropic/claude-fable-5 | 5 | 202 | 402 | 104,475,086 | 3,820,388 | 314,216 | $196.60 |
| anthropic/claude-opus-5 | 1 | 126 | 252 | 49,152,905 | 2,409,204 | 148,940 | $52.39 |
| openai/gpt-5.6-sol | 7 | — | 1,608,619 | 58,945,536 | 0 | 212,114 | $43.88 |
| openai/gpt-5.5 | 1 | 6 | 5,393 | 516,096 | 0 | 137 | $0.29 |
| **Total** | **14** | | | | | | **$293.16** |

## Evidence inventory

One row per immutable ledger entry. The digest is the SHA-256 of the raw provider session log, which is retained privately and available to the organizer on request.

| Period end | Session | Model | Category | Provider tokens | API-equiv | Raw evidence | Commits/artifacts |
| --- | --- | --- | --- | ---: | ---: | --- | --- |
| 2026-08-10 | Fable / Walt build session | claude-fable-5 | planning design engineering | 42,866,776 | $84.71 | `fda3b9d08379…` (1232 lines) | `6c15921` `ec7fab1` `a6fad91` `2995105` `3cf2cc7` `0943c0b` `cf5cf41` `aa2cc5f` `25da59e` `86d461c` `README.md` `docs/CRIT` `docs/AIRT` `src/worke` `src/web` `demo-data` |
| 2026-08-10 | Opus / Walt build session | claude-opus-5 | planning design engineering | 51,711,301 | $52.39 | `fda3b9d08379…` (1232 lines) | `6c15921` `ec7fab1` `a6fad91` `2995105` `3cf2cc7` `0943c0b` `cf5cf41` `aa2cc5f` `25da59e` `86d461c` `README.md` `docs/CRIT` `docs/AIRT` `src/worke` `src/web` `demo-data` |
| 2026-08-10 | Codex engineering task | gpt-5.6-sol | engineering qa release | 43,423,830 | $30.75 | `114fae628efb…` (1692 lines) | `86e8164` `6cc5521` `8ad5cdc` `4bd314f` `a6acb33` `a8e8ec3` `9fe5ec2` `6e495d9` `docs/CRIT` `src/share` `src/worke` `src/web` `.github/w` |
| 2026-08-10 | Walt planning and handoff | gpt-5.5 | planning handoff | 521,626 | $0.29 | `dc84cf49885a…` (318 lines) | `86e8164` `docs/CRIT` |
| 2026-08-10 | Codex engineering task | gpt-5.6-sol | engineering qa release | 2,816,735 | $2.84 | `3ec5834d5388…` (1848 lines) | `9a93742` `usage` `scripts/u` `src/share` `.github/w` |
| 2026-08-10 | Codex engineering task | gpt-5.6-sol | engineering qa release | 4,824,828 | $2.92 | `327cf8006963…` (1991 lines) | `5e8635c` `seed/seed` `src/web/l` `https://g` |
| 2026-08-10 | Codex engineering task | gpt-5.6-sol | engineering qa release | 6,534,583 | $4.80 | `9265f53fbfea…` (2176 lines) | — |
| 2026-08-10 | Fable / Opus / Walt build session | claude-fable-5 | planning design engineering | 48,951,849 | $79.43 | `7c6a07d96670…` (1594 lines) | — |
| 2026-08-10 | Codex engineering task | gpt-5.6-sol | engineering qa release | 904,375 | $0.59 | `535d486d464a…` (2210 lines) | `.githooks` `docs/AIRT` `index.htm` `package.j` `public/og` `scripts/i` `scripts/u` `src/share` `src/worke` `src/worke` `usage/REA` `usage/REP` `usage/led` `usage/sou` `wrangler.` |
| 2026-08-10 | Fable / Opus / Walt build session | claude-fable-5 | planning design engineering | 9,843,686 | $10.95 | `fcb18de7634c…` (1652 lines) | `.githooks` `docs/AIRT` `index.htm` `package.j` `public/og` `scripts/i` `scripts/u` `src/share` `src/worke` `src/worke` `usage/REA` `usage/REP` `usage/led` `usage/sou` `wrangler.` |
| 2026-08-10 | Codex engineering task | gpt-5.6-sol | engineering qa release | 1,126,835 | $1.15 | `fccbeefab8f8…` (2335 lines) | `scripts/u` `usage/REA` `usage/sou` |
| 2026-08-10 | Fable / Opus / Walt build session | claude-fable-5 | planning design engineering | 1,534,896 | $1.66 | `e748223c9afc…` (1662 lines) | `scripts/u` `usage/REA` `usage/sou` |
| 2026-08-10 | Codex engineering task | gpt-5.6-sol | engineering qa release | 1,135,083 | $0.83 | `0f5ad5f58a49…` (2414 lines) | `docs/DEMO` |
| 2026-08-10 | Fable / Opus / Walt build session | claude-fable-5 | planning design engineering | 5,412,885 | $19.84 | `6d29add22452…` (1690 lines) | `docs/DEMO` |

## How to audit this

1. `pnpm usage:check` — validates every entry against the schema, recomputes each cost from [pricing.json](pricing.json), rejects duplicate evidence, and confirms this report matches the ledger digest above.
2. `git log --follow usage/ledger.jsonl` — the ledger is append-only; history shows every addition in context.
3. Compare any entry's `sha256` against the raw session log we provide on request; the line count must match.
4. Check receipts against entries marked `pending_subscription_receipt` when the claim is filed.
