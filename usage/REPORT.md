# AI usage reimbursement audit

Generated 2026-08-11 14:56 UTC by `pnpm usage:report`. Do not edit by hand — regenerate instead.

Ledger digest: `e2bed6a2e5607a79c604359beb531abe7ee548f977df2ecf036d900b2cee6a9a` (72 entries). `pnpm usage:check` fails if this file no longer matches the ledger.
Receipt-allocation digest: `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` (0 records). Raw receipts remain private.

## The three numbers, kept separate

1. **Provider-reported tokens** — counters copied from local provider session logs.
2. **API-equivalent estimate — $624.05** — those tokens at pinned public list prices ([pricing.json](pricing.json)). A workload gauge, not a bill.
3. **Actual billed spend — $0.00 evidenced so far** — the number a reimbursement claim uses. 71 usage entries remain uncovered by a recorded receipt.

The [brief](https://docs.google.com/document/d/1rBHJtiNKHv4i43tdf2Rm0sDEYuIcajhmAPoBKR_Az-A/) allows a valid submission up to **$500** in token-cost reimbursement, including qualifying Codex Pro / Claude Max subscription usage, subject to proof and organizer review. The claim will be the receipt amounts, capped at $500 — never the API-equivalent gauge.

## Workload by model

| Provider / model | Entries | Calls | Input | Cache reads | Cache writes | Output | API-equivalent USD |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| anthropic/claude-fable-5 | 29 | 543 | 1,084 | 253,446,077 | 7,386,053 | 632,952 | $432.83 |
| anthropic/claude-opus-5 | 1 | 126 | 252 | 49,152,905 | 2,409,204 | 148,940 | $52.39 |
| openai/gpt-5.6-sol | 40 | — | 3,979,524 | 206,071,552 | 0 | 519,993 | $138.53 |
| openai/gpt-5.5 | 1 | 6 | 5,393 | 516,096 | 0 | 137 | $0.29 |
| anthropic/claude-sonnet-5 | 1 | 1 | 1,109 | 0 | 0 | 389 | $0.01 |
| **Total** | **72** | | | | | | **$624.05** |

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
| 2026-08-10 | Codex engineering task | gpt-5.6-sol | engineering qa release | 1,904,643 | $1.44 | `38a76e25caf8…` (3470 lines) | `README.md` `docs/AIRT` `scripts/s` `src/worke` |
| 2026-08-10 | Fable / Opus / Walt build session | claude-fable-5 | planning design engineering | 867,081 | $0.96 | `2c9e77e23173…` (1892 lines) | `README.md` `docs/AIRT` `scripts/s` `src/worke` |
| 2026-08-10 | Codex engineering task | gpt-5.6-sol | engineering qa release | 6,119,791 | $3.97 | `6b73ce68d99c…` (3698 lines) | `README.md` `docs/AIRT` `docs/CRIT` `docs/DEMO` `docs/DEMO` `docs/SUBM` `package.j` `scripts/r` `scripts/s` `src/share` `src/web/p` `src/worke` `src/worke` `src/worke` `src/worke` `src/worke` |
| 2026-08-10 | Fable / Opus / Walt build session | claude-fable-5 | planning design engineering | 871,845 | $1.00 | `7eaafb3e4c40…` (1903 lines) | `README.md` `docs/AIRT` `docs/CRIT` `docs/DEMO` `docs/DEMO` `docs/SUBM` `package.j` `scripts/r` `scripts/s` `src/share` `src/web/p` `src/worke` `src/worke` `src/worke` `src/worke` `src/worke` |
| 2026-08-10 | Codex engineering task | gpt-5.6-sol | engineering qa release | 2,441,235 | $1.40 | `590378334b9b…` (3762 lines) | `docs/CRIT` `docs/SUBM` |
| 2026-08-10 | Fable / Opus / Walt build session | claude-fable-5 | planning design engineering | 5,254,323 | $5.62 | `80c8bb4101b9…` (1930 lines) | `docs/CRIT` `docs/SUBM` |
| 2026-08-10 | Codex engineering task | gpt-5.6-sol | engineering qa release | 8,640,134 | $5.26 | `caac5b3d9b2c…` (4017 lines) | `README.md` `docs/CRIT` `docs/DEMO` `docs/SUBM` `src/web/c` `src/web/p` `src/web/p` `src/worke` |
| 2026-08-10 | Fable / Opus / Walt build session | claude-fable-5 | planning design engineering | 6,201,512 | $6.83 | `80833e19f2a5…` (1968 lines) | `README.md` `docs/CRIT` `docs/DEMO` `docs/SUBM` `src/web/c` `src/web/p` `src/web/p` `src/worke` |
| 2026-08-10 | Codex engineering task | gpt-5.6-sol | engineering qa release | 1,550,092 | $1.19 | `15103409c0f0…` (4149 lines) | `src/web/p` |
| 2026-08-10 | Fable / Opus / Walt build session | claude-fable-5 | planning design engineering | 895,179 | $1.05 | `0cead194a473…` (1974 lines) | `src/web/p` |
| 2026-08-10 | Codex engineering task | gpt-5.6-sol | engineering qa release | 1,223,855 | $0.80 | `b3106d67ad3c…` (4212 lines) | `docs/CRIT` |
| 2026-08-10 | Codex engineering task | gpt-5.6-sol | engineering qa release | 1,739,389 | $1.15 | `775e55a4006f…` (4311 lines) | `.gitignor` |
| 2026-08-10 | Codex engineering task | gpt-5.6-sol | engineering qa release | 14,746,812 | $9.18 | `f2e6950dbb69…` (4759 lines) | `.githooks` `docs/SUBM` `package.j` `scripts/u` `src/share` `usage/REA` `usage/REP` `usage/pri` |
| 2026-08-10 | Codex engineering task | gpt-5.6-sol | engineering qa release | 3,964,376 | $2.98 | `e369c0fd1703…` (5022 lines) | `README.md` `docs/CRIT` `docs/SUBM` `docs/WALK` `package.j` `scripts/r` `scripts/s` |
| 2026-08-10 | Codex engineering task | gpt-5.6-sol | engineering qa release | 3,773,078 | $2.36 | `feefec3bba2d…` (5159 lines) | `.dev.vars` `src/share` `src/share` `src/share` `src/web/c` `src/web/l` `src/web/p` `src/web/p` `src/worke` `src/worke` `src/worke` `src/worke` |
| 2026-08-10 | Fable / Opus / Walt build session | claude-fable-5 | planning design engineering | 23,420,265 | $25.90 | `1644c2007504…` (2121 lines) | `.dev.vars` `src/share` `src/share` `src/share` `src/web/c` `src/web/l` `src/web/p` `src/web/p` `src/worke` `src/worke` `src/worke` `src/worke` |
| 2026-08-10 | Fable / Opus / Walt build session | claude-fable-5 | planning design engineering | 3,816,389 | $3.99 | `5f3e389bc207…` (2137 lines) | — |
| 2026-08-10 | Fable / Opus / Walt build session | claude-fable-5 | planning design engineering | 955,711 | $0.99 | `b4294ae16fa1…` (2139 lines) | `scripts/u` `usage/REP` `usage/led` |
| 2026-08-10 | Codex engineering task | gpt-5.6-sol | engineering qa release | 5,994,936 | $3.74 | `644e0b12cf0f…` (5344 lines) | `README.md` `docs/API.` `docs/CRIT` `docs/SUBM` `scripts/u` `src/share` `src/share` `src/share` `src/worke` `src/worke` `usage/REA` |
| 2026-08-10 | Fable / Opus / Walt build session | claude-fable-5 | planning design engineering | 1,913,327 | $1.99 | `5a7cd75e883b…` (2144 lines) | `README.md` `docs/API.` `docs/CRIT` `docs/SUBM` `scripts/u` `src/share` `src/share` `src/share` `src/worke` `src/worke` `usage/REA` |
| 2026-08-10 | Codex engineering task | gpt-5.6-sol | engineering qa release | 6,542,259 | $3.67 | `c7a80f2c9f2d…` (5488 lines) | `README.md` `docs/DEMO` `docs/LIAM` `src/worke` |
| 2026-08-10 | Fable / Opus / Walt build session | claude-fable-5 | planning design engineering | 9,712,761 | $28.18 | `365bce3b54d9…` (2199 lines) | `README.md` `docs/DEMO` `docs/LIAM` `src/worke` |
| 2026-08-10 | Codex engineering task | gpt-5.6-sol | engineering qa release | 1,061,792 | $1.27 | `73446c2d8d56…` (5602 lines) | `README.md` `docs/API.` `docs/CRIT` `docs/SUBM` `migration` `package.j` `scripts/s` `scripts/u` `src/share` `src/worke` `src/worke` `src/worke` `usage/REA` `usage/pri` |
| 2026-08-10 | Fable / Opus / Walt build session | claude-fable-5 | planning design engineering | 979,897 | $1.05 | `48834cbcbb53…` (2202 lines) | `README.md` `docs/API.` `docs/CRIT` `docs/SUBM` `migration` `package.j` `scripts/s` `scripts/u` `src/share` `src/worke` `src/worke` `src/worke` `usage/REA` `usage/pri` |
| 2026-08-10 | SpeakerOps runtime | claude-sonnet-5 | runtime ai feature | 1,498 | $0.01 | `2bbea8a48d2b…` (1 lines) | `8d111dce8` `https://s` `runtime:d` |
| 2026-08-10 | Codex engineering task | gpt-5.6-sol | engineering qa release | 752,083 | $0.53 | `2179c1e67b0d…` (5643 lines) | `usage/REP` `usage/led` |
| 2026-08-10 | Codex engineering task | gpt-5.6-sol | engineering qa release | 7,525,937 | $4.98 | `38ca47faa094…` (5914 lines) | `README.md` `docs/API.` `docs/SUBM` `package.j` `scripts/s` `scripts/s` `src/worke` `submissio` |
| 2026-08-10 | Codex engineering task | gpt-5.6-sol | engineering qa release | 3,630,428 | $2.08 | `6bb3bea70369…` (5997 lines) | `scripts/s` `submissio` |
| 2026-08-10 | Codex engineering task | gpt-5.6-sol | engineering qa release | 2,199,646 | $1.50 | `87aa8fb279ad…` (6097 lines) | — |
| 2026-08-10 | Codex engineering task | gpt-5.6-sol | engineering qa release | 50,350 | $0.04 | `60b25a7ba89d…` (6102 lines) | — |
| 2026-08-10 | Codex engineering task | gpt-5.6-sol | engineering qa release | 2,267,999 | $1.76 | `22b51b15aeee…` (6257 lines) | `scripts/u` `src/share` `usage/REA` `usage/REP` `usage/led` `usage/pri` |
| 2026-08-10 | Codex engineering task | gpt-5.6-sol | engineering qa release | 4,025,766 | $2.46 | `bdbbe182da71…` (6387 lines) | `docs/CRIT` `scripts/r` `scripts/s` |
| 2026-08-10 | Codex engineering task | gpt-5.6-sol | engineering qa release | 5,761,521 | $3.53 | `11c6ffb14c0f…` (6575 lines) | `scripts/u` `src/share` `usage/REA` |
| 2026-08-10 | Codex engineering task | gpt-5.6-sol | engineering qa release | 3,474,260 | $1.94 | `671379dc2bf0…` (6661 lines) | `README.md` `docs/DEMO` `docs/LIAM` `src/share` `src/share` `src/share` `src/web/c` `src/web/p` `src/web/p` `src/worke` `src/worke` `src/worke` `src/worke` `src/worke` `src/worke` |
| 2026-08-10 | Fable / Opus / Walt build session | claude-fable-5 | planning design engineering | 17,717,236 | $43.31 | `0e5f7515e199…` (2688 lines) | `README.md` `docs/DEMO` `docs/LIAM` `src/share` `src/share` `src/share` `src/web/c` `src/web/p` `src/web/p` `src/worke` `src/worke` `src/worke` `src/worke` `src/worke` `src/worke` |
| 2026-08-11 | Fable / Opus / Walt build session | claude-fable-5 | planning design engineering | 18,090,172 | $26.27 | `f8e3e13283d6…` (2986 lines) | `README.md` `docs/DEMO` `docs/LIAM` `src/share` `src/web/l` `src/web/p` `src/web/p` `src/worke` `src/worke` `src/worke` `src/worke` `src/worke` |
| 2026-08-11 | Codex engineering task | gpt-5.6-sol | engineering qa release | 29,484,717 | $18.76 | `478ddc6f1d2c…` (7737 lines) | `index.htm` `src/web/p` `src/web/p` `src/worke` |
| 2026-08-11 | Fable / Opus / Walt build session | claude-fable-5 | planning design engineering | 12,069,902 | $25.40 | `2e6c2a94e003…` (3150 lines) | `index.htm` `src/web/p` `src/web/p` `src/worke` |
| 2026-08-11 | Fable / Opus / Walt build session | claude-fable-5 | planning design engineering | 16,827,992 | $26.27 | `053b2e0408fb…` (3371 lines) | `README.md` `docs/SELF` `seed/seed` `src/share` `src/web/p` `src/web/p` `src/worke` |

## Receipt allocations

Receipt files stay in `usage/private/`. The tracked allocation ledger stores only a SHA-256, byte size, billing period, amount, and the usage-entry ids covered, preventing the same work or receipt from being claimed twice.

| Billing period | Provider | Receipt label | Actual USD | Usage entries covered | Private receipt evidence |
| --- | --- | --- | ---: | ---: | --- |
| — | — | No receipt recorded yet | $0.00 | 0 | — |

## How to audit this

1. `pnpm usage:check` — validates every entry against the schema, recomputes each cost from [pricing.json](pricing.json), rejects duplicate evidence, and confirms this report matches the ledger digest above.
2. `git log --follow usage/ledger.jsonl` — the ledger is append-only; history shows every addition in context.
3. Compare any entry's `sha256` against the raw session log we provide on request; the line count must match.
4. `pnpm usage:receipt -- ...` hashes a private receipt and appends an immutable allocation record; validation rejects duplicate receipt files and overlapping usage-entry coverage.
