# AI usage reimbursement audit

Generated 2026-08-10 20:09 UTC by `pnpm usage:report`. Do not edit by hand — regenerate instead.

Ledger digest: `b893da34e7605e5e1835c7e164ebe473f75ad1e7af88f4936b04d7c6513b5745` (33 entries). `pnpm usage:check` fails if this file no longer matches the ledger.

## The three numbers, kept separate

1. **Provider-reported tokens** — counters copied from local provider session logs.
2. **API-equivalent estimate — $349.24** — those tokens at pinned public list prices ([pricing.json](pricing.json)). A workload gauge, not a bill.
3. **Actual billed spend — $0.00 evidenced so far** — the number a reimbursement claim uses. 32 entries await subscription receipts.

The [brief](https://docs.google.com/document/d/1rBHJtiNKHv4i43tdf2Rm0sDEYuIcajhmAPoBKR_Az-A/) allows a valid submission up to **$500** in token-cost reimbursement, including qualifying Codex Pro / Claude Max subscription usage, subject to proof and organizer review. The claim will be the receipt amounts, capped at $500 — never the API-equivalent gauge.

## Workload by model

| Provider / model | Entries | Calls | Input | Cache reads | Cache writes | Output | API-equivalent USD |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| anthropic/claude-fable-5 | 14 | 242 | 482 | 137,601,947 | 3,903,531 | 366,614 | $234.01 |
| anthropic/claude-opus-5 | 1 | 126 | 252 | 49,152,905 | 2,409,204 | 148,940 | $52.39 |
| openai/gpt-5.6-sol | 17 | — | 2,019,172 | 89,418,496 | 0 | 258,302 | $62.55 |
| openai/gpt-5.5 | 1 | 6 | 5,393 | 516,096 | 0 | 137 | $0.29 |
| **Total** | **33** | | | | | | **$349.24** |

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
| 2026-08-10 | Codex engineering task | gpt-5.6-sol | engineering qa release | 5,597,158 | $3.80 | `652276ef924f…` (2612 lines) | `docs/CRIT` `package.j` `scripts/s` |
| 2026-08-10 | Fable / Opus / Walt build session | claude-fable-5 | planning design engineering | 780,227 | $0.86 | `b7a9f87af44c…` (1694 lines) | `docs/CRIT` `package.j` `scripts/s` |
| 2026-08-10 | Codex engineering task | gpt-5.6-sol | engineering qa release | 4,343,267 | $2.56 | `d73dcd42eb0e…` (2736 lines) | `scripts/s` `src/worke` |
| 2026-08-10 | Codex engineering task | gpt-5.6-sol | engineering qa release | 2,776,403 | $1.55 | `f8ea592533ec…` (2804 lines) | `scripts/s` `src/worke` |
| 2026-08-10 | Fable / Opus / Walt build session | claude-fable-5 | planning design engineering | 3,157,933 | $3.78 | `47642f134019…` (1721 lines) | `scripts/s` `src/worke` |
| 2026-08-10 | Codex engineering task | gpt-5.6-sol | engineering qa release | 5,931,217 | $3.32 | `33249aea7913…` (2945 lines) | `src/worke` `src/worke` |
| 2026-08-10 | Fable / Opus / Walt build session | claude-fable-5 | planning design engineering | 7,323,868 | $8.26 | `2851e3161293…` (1765 lines) | `src/worke` `src/worke` |
| 2026-08-10 | Codex engineering task | gpt-5.6-sol | engineering qa release | 858,709 | $0.48 | `305446d8ae15…` (2959 lines) | `README.md` `src/worke` `src/worke` `src/worke` `src/worke` |
| 2026-08-10 | Fable / Opus / Walt build session | claude-fable-5 | planning design engineering | 1,646,302 | $1.90 | `2e768c98560b…` (1776 lines) | `README.md` `src/worke` `src/worke` `src/worke` `src/worke` |
| 2026-08-10 | Codex engineering task | gpt-5.6-sol | engineering qa release | 3,562,318 | $2.04 | `cd08e2c90dd1…` (3042 lines) | `scripts/s` `src/share` `src/web/l` `src/web/p` |
| 2026-08-10 | Fable / Opus / Walt build session | claude-fable-5 | planning design engineering | 4,151,927 | $4.64 | `b1c265cc1ffe…` (1803 lines) | `scripts/s` `src/share` `src/web/l` `src/web/p` |
| 2026-08-10 | Codex engineering task | gpt-5.6-sol | engineering qa release | 4,251,375 | $2.33 | `408aa812bdce…` (3116 lines) | `docs/CRIT` `docs/SUBM` `scripts/s` |
| 2026-08-10 | Fable / Opus / Walt build session | claude-fable-5 | planning design engineering | 2,515,225 | $2.74 | `7de136072d56…` (1812 lines) | `docs/CRIT` `docs/SUBM` `scripts/s` |
| 2026-08-10 | Codex engineering task | gpt-5.6-sol | engineering qa release | 2,937,677 | $2.04 | `d168bc3d3adb…` (3293 lines) | `docs/SUBM` |
| 2026-08-10 | Fable / Opus / Walt build session | claude-fable-5 | planning design engineering | 8,510,817 | $9.52 | `04ea9afdaa4e…` (1861 lines) | `docs/SUBM` |
| 2026-08-10 | Codex engineering task | gpt-5.6-sol | engineering qa release | 275,593 | $0.20 | `aefa16afb8ac…` (3325 lines) | `src/worke` `src/worke` `src/worke` |
| 2026-08-10 | Fable / Opus / Walt build session | claude-fable-5 | planning design engineering | 1,721,697 | $2.04 | `692c09d1f025…` (1870 lines) | `src/worke` `src/worke` `src/worke` |
| 2026-08-10 | Codex engineering task | gpt-5.6-sol | engineering qa release | 395,984 | $0.36 | `04115983aed5…` (3348 lines) | `README.md` |
| 2026-08-10 | Fable / Opus / Walt build session | claude-fable-5 | planning design engineering | 3,454,486 | $3.67 | `a7b6be0ed846…` (1884 lines) | `README.md` |

## How to audit this

1. `pnpm usage:check` — validates every entry against the schema, recomputes each cost from [pricing.json](pricing.json), rejects duplicate evidence, and confirms this report matches the ledger digest above.
2. `git log --follow usage/ledger.jsonl` — the ledger is append-only; history shows every addition in context.
3. Compare any entry's `sha256` against the raw session log we provide on request; the line count must match.
4. Check receipts against entries marked `pending_subscription_receipt` when the claim is filed.
