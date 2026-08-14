# AI usage reimbursement audit

Generated 2026-08-14 17:12 UTC by `pnpm usage:report`. Do not edit by hand — regenerate instead.

Ledger digest: `9db53f115bff11832a54f6cea098e65a8e57b09d4a818b369bea2a6513a36109` (215 entries). `pnpm usage:check` fails if this file no longer matches the ledger.
Receipt-allocation digest: `4d31cc087e3eb57ca6a14c0f5348cdd451d191622a46d7810cbed0d8f1de9d06` (67 records). Raw receipts remain private.

## The three numbers, kept separate

1. **Provider-reported tokens** — counters copied from local provider session logs.
2. **API-equivalent estimate — $1861.41** — those tokens at pinned public list prices ([pricing.json](pricing.json)). A workload gauge, not a bill.
3. **Actual billed spend — $509.59 evidenced so far** — the number a reimbursement claim uses, backed by 4 primary billing records plus 63 zero-dollar coverage extensions. 1 usage entry remain uncovered by recorded evidence.

The [brief](https://docs.google.com/document/d/1rBHJtiNKHv4i43tdf2Rm0sDEYuIcajhmAPoBKR_Az-A/) allows a valid submission up to **$500** in token-cost reimbursement, including qualifying Codex Pro / Claude Max subscription usage, subject to proof and organizer review. The claim will be the receipt amounts, capped at $500 — never the API-equivalent gauge.

## Workload by model

| Provider / model | Entries | Calls | Input | Cache reads | Cache writes | Output | API-equivalent USD |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| anthropic/claude-fable-5 | 72 | 1434 | 3,914 | 689,987,014 | 20,185,517 | 1,205,870 | $1154.03 |
| anthropic/claude-opus-5 | 24 | 651 | 845,536 | 393,090,622 | 12,462,192 | 599,760 | $340.39 |
| openai/gpt-5.6-sol | 98 | — | 10,465,764 | 475,705,344 | 0 | 1,096,916 | $323.09 |
| openai/gpt-5.5 | 1 | 6 | 5,393 | 516,096 | 0 | 137 | $0.29 |
| anthropic/claude-sonnet-5 | 16 | 13 | 26,863 | 102,153,695 | 3,480,757 | 429,907 | $33.49 |
| anthropic/claude-opus-4-8 | 1 | 17 | 34 | 8,979,232 | 535,436 | 7,291 | $10.03 |
| anthropic/claude-haiku-4-5-20251001 | 3 | 2 | 21,600 | 276,442 | 23,992 | 4,843 | $0.10 |
| **Total** | **215** | | | | | | **$1861.41** |

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
| 2026-08-11 | Fable / Opus / Walt build session | claude-fable-5 | planning design engineering | 1,263,914 | $8.93 | `d33cb710861f…` (3712 lines) | `src/share` `src/web/c` `src/web/l` `src/web/p` `src/web/p` `src/web/p` `src/web/p` `src/web/p` `src/worke` `src/worke` |
| 2026-08-11 | Fable / Opus / Walt build session | claude-opus-5 | planning design engineering | 31,601,531 | $27.31 | `d33cb710861f…` (3712 lines) | `src/share` `src/web/c` `src/web/l` `src/web/p` `src/web/p` `src/web/p` `src/web/p` `src/web/p` `src/worke` `src/worke` |
| 2026-08-11 | Fable / Opus / Walt build session | claude-opus-5 | planning design engineering | 23,247,081 | $16.56 | `ddd5efa7546b…` (3910 lines) | `README.md` `docs/DEMO` `src/share` `src/share` `src/share` `src/web/c` `src/web/l` `src/web/p` `src/web/p` `src/web/p` `src/worke` `src/worke` `src/worke` `src/worke` `src/worke` |
| 2026-08-11 | Fable / Opus / Walt build session | claude-opus-5 | planning design engineering | 9,433,241 | $9.57 | `cbb6ddd6a4b3…` (3991 lines) | `package.j` `scripts/s` `seed/head` `src/web/c` |
| 2026-08-11 | Codex engineering task | gpt-5.6-sol | engineering qa release | 777,296 | $1.79 | `f269c39a22cb…` (7828 lines) | — |
| 2026-08-11 | Fable / Opus / Walt build session | claude-opus-5 | planning design engineering | 505,308 | $0.28 | `b51ad00da1a6…` (3993 lines) | — |
| 2026-08-11 | Codex engineering task | gpt-5.6-sol | engineering qa release | 177,539 | $0.21 | `11be0c3abb36…` (7851 lines) | `seed/head` `seed/head` `seed/head` `seed/head` `seed/head` `usage/REP` `usage/led` |
| 2026-08-11 | Codex engineering task | gpt-5.6-sol | engineering qa release | 1,701,176 | $1.18 | `4589bb84bce2…` (7952 lines) | — |
| 2026-08-11 | Codex engineering task | gpt-5.6-sol | engineering qa release | 102,214 | $0.08 | `ec1fab62ca4d…` (7956 lines) | `usage/REP` `usage/led` |
| 2026-08-11 | Codex engineering task | gpt-5.6-sol | engineering qa release | 3,775,032 | $3.09 | `0e8a1dce5d78…` (8140 lines) | — |
| 2026-08-11 | Fable / Opus / Walt build session | claude-opus-5 | planning design engineering | 28,146,615 | $24.48 | `d291af8ec0b9…` (4262 lines) | — |
| 2026-08-10 | SpeakerOps runtime | claude-sonnet-5 | runtime ai feature | 1,601 | $0.01 | `78afffcb6155…` (1 lines) | `c1d6db463` `https://s` `runtime:d` |
| 2026-08-11 | SpeakerOps runtime | claude-sonnet-5 | runtime ai feature | 1,449 | $0.01 | `d6261eca945e…` (1 lines) | `c1d6db463` `https://s` `runtime:d` |
| 2026-08-11 | SpeakerOps runtime | claude-sonnet-5 | runtime ai feature | 1,634 | $0.01 | `17427a708a2f…` (1 lines) | `c1d6db463` `https://s` `runtime:d` |
| 2026-08-11 | SpeakerOps runtime | claude-sonnet-5 | runtime ai feature | 1,608 | $0.01 | `781279646065…` (1 lines) | `c1d6db463` `https://s` `runtime:s` |
| 2026-08-11 | SpeakerOps runtime | claude-sonnet-5 | runtime ai feature | 1,785 | $0.01 | `e6c6e47b5aa3…` (1 lines) | `c1d6db463` `https://s` `runtime:d` |
| 2026-08-11 | SpeakerOps runtime | claude-sonnet-5 | runtime ai feature | 1,550 | $0.01 | `ef85234675da…` (1 lines) | `c1d6db463` `https://s` `runtime:d` |
| 2026-08-11 | SpeakerOps runtime | claude-sonnet-5 | runtime ai feature | 1,627 | $0.01 | `2f58625bdf53…` (1 lines) | `c1d6db463` `https://s` `runtime:s` |
| 2026-08-11 | Codex engineering task | gpt-5.6-sol | engineering qa release | 2,915,925 | $1.94 | `e702404fe6e6…` (8223 lines) | `scripts/u` `src/share` `usage/REA` `usage/REP` `usage/led` `usage/pri` |
| 2026-08-11 | Fable / Opus / Walt build session | claude-opus-5 | planning design engineering | 1,760,715 | $1.10 | `f792949fe7a6…` (4285 lines) | `scripts/u` `src/share` `usage/REA` `usage/REP` `usage/led` `usage/pri` |
| 2026-08-11 | Codex engineering task | gpt-5.6-sol | engineering qa release | 1,626,509 | $0.94 | `8ae23267adfd…` (8258 lines) | `README.md` `docs/DEMO` `src/share` `src/share` `src/share` `src/web/c` `src/web/p` `src/web/p` `src/worke` `src/worke` `src/worke` `src/worke` |
| 2026-08-11 | Fable / Opus / Walt build session | claude-fable-5 | planning design engineering | 10,816,913 | $23.39 | `40f2dbc90ed8…` (4472 lines) | `README.md` `docs/DEMO` `src/share` `src/share` `src/share` `src/web/c` `src/web/p` `src/web/p` `src/worke` `src/worke` `src/worke` `src/worke` `usage/REP` `usage/led` `usage/pri` |
| 2026-08-11 | Fable / Opus / Walt build session | claude-opus-5 | planning design engineering | 3,171,612 | $7.48 | `40f2dbc90ed8…` (4472 lines) | `README.md` `docs/DEMO` `src/share` `src/share` `src/share` `src/web/c` `src/web/p` `src/web/p` `src/worke` `src/worke` `src/worke` `src/worke` `usage/REP` `usage/led` `usage/pri` |
| 2026-08-11 | Fable / Opus / Walt build session | claude-opus-4-8 | planning design engineering | 9,521,993 | $10.03 | `40f2dbc90ed8…` (4472 lines) | `README.md` `docs/DEMO` `src/share` `src/share` `src/share` `src/web/c` `src/web/p` `src/web/p` `src/worke` `src/worke` `src/worke` `src/worke` `usage/REP` `usage/led` `usage/pri` |
| 2026-08-11 | Fable / Opus / Walt build session | claude-opus-5 | planning design engineering | 7,133,285 | $3.90 | `6de62c814604…` (4517 lines) | `README.md` `docs/DEMO` `scripts/u` `src/share` `src/share` `src/share` `src/web/c` `src/web/p` `src/web/p` `src/worke` `src/worke` `src/worke` `src/worke` `usage/REP` `usage/led` `usage/pri` |
| 2026-08-11 | Fable / Opus / Walt build session | claude-fable-5 | planning design engineering | 15,624,318 | $29.30 | `55a635e0f3fd…` (4650 lines) | `src/web/p` |
| 2026-08-11 | Fable / Opus / Walt build session | claude-opus-5 | planning design engineering | 3,304,994 | $1.93 | `55a635e0f3fd…` (4650 lines) | `src/web/p` |
| 2026-08-12 | Codex engineering task | gpt-5.6-sol | engineering qa release | 23,737,686 | $14.94 | `c034571aceca…` (8766 lines) | — |
| 2026-08-12 | Fable / Opus / Walt build session | claude-fable-5 | planning design engineering | 20,066,364 | $35.35 | `e250fc5cc1bf…` (4931 lines) | — |
| 2026-08-12 | Fable / Opus / Walt build session | claude-opus-5 | planning design engineering | 18,405,592 | $22.67 | `e250fc5cc1bf…` (4931 lines) | — |
| 2026-08-12 | Codex engineering task | gpt-5.6-sol | engineering qa release | 1,910,998 | $1.02 | `12eae1952bcd…` (8793 lines) | `docs/EVAL` `migration` `migration` `seed/seed` `src/share` `src/share` `src/share` `src/share` `src/share` `src/share` `src/share` `src/share` `src/web/A` `src/web/c` `src/web/l` `src/web/p` `src/web/p` `src/web/p` `src/web/p` `src/web/p` `src/web/p` `src/web/p` `src/web/p` `src/web/p` `src/web/p` `src/web/p` `src/worke` `src/worke` `src/worke` `src/worke` `usage/REP` `usage/led` |
| 2026-08-12 | Codex engineering task | gpt-5.6-sol | engineering qa release | 722,663 | $0.38 | `fe7677b87b09…` (8801 lines) | — |
| 2026-08-12 | Codex engineering task | gpt-5.6-sol | engineering qa release | 484,872 | $0.28 | `6c56cf3fe400…` (8807 lines) | `usage/REP` `usage/led` |
| 2026-08-12 | Codex engineering task | gpt-5.6-sol | engineering qa release | 8,820,304 | $6.92 | `a799a20664ab…` (9183 lines) | — |
| 2026-08-12 | Codex engineering task | gpt-5.6-sol | engineering qa release | 1,378,068 | $0.80 | `6f4a8890c5af…` (9215 lines) | `.dev.vars` `README.md` `docs/EVAL` `package.j` `scripts/r` `scripts/v` `src/share` `src/share` `src/web/c` `src/worke` `src/worke` `src/worke` `src/worke` `src/worke` `src/worke` `usage/REP` `usage/led` `wrangler.` |
| 2026-08-12 | Codex engineering task | gpt-5.6-sol | engineering qa release | 1,236,645 | $0.71 | `49cb551b3e74…` (9244 lines) | `docs/EVAL` |
| 2026-08-12 | Codex engineering task | gpt-5.6-sol | engineering qa release | 10,219,795 | $6.68 | `510a9450001e…` (9613 lines) | — |
| 2026-08-12 | Codex engineering task | gpt-5.6-sol | engineering qa release | 2,062,477 | $1.30 | `52ef030248c3…` (9683 lines) | `docs/EVAL` `seed/seed` `src/share` `src/web/l` `src/web/p` `src/web/p` `src/web/p` `src/worke` `src/worke` `usage/REP` `usage/led` |
| 2026-08-12 | Codex engineering task | gpt-5.6-sol | engineering qa release | 1,805,423 | $1.15 | `6b8714e29f5e…` (9741 lines) | — |
| 2026-08-12 | Codex engineering task | gpt-5.6-sol | engineering qa release | 129,137 | $0.08 | `4085042619f7…` (9743 lines) | `docs/EVAL` `src/share` `src/web/p` `src/web/p` `src/web/p` `src/worke` `usage/REP` `usage/led` |
| 2026-08-12 | Codex engineering task | gpt-5.6-sol | engineering qa release | 7,391,912 | $4.93 | `58b739f1875f…` (9961 lines) | — |
| 2026-08-12 | Fable / Opus / Walt build session | claude-fable-5 | planning design engineering | 3,945,195 | $33.26 | `e1e9a3099e56…` (4973 lines) | — |
| 2026-08-11 | SpeakerOps runtime | claude-sonnet-5 | runtime ai feature | 1,446 | $0.01 | `57cf068f5ba2…` (1 lines) | `c7863af00` `https://s` `runtime:d` |
| 2026-08-11 | SpeakerOps runtime | claude-sonnet-5 | runtime ai feature | 1,616 | $0.01 | `ef2438d80875…` (1 lines) | `c7863af00` `https://s` `runtime:d` |
| 2026-08-12 | SpeakerOps runtime | claude-sonnet-5 | runtime ai feature | 1,540 | $0.01 | `a2a1cf3bf08b…` (1 lines) | `c7863af00` `https://s` `runtime:d` |
| 2026-08-12 | SpeakerOps runtime | claude-sonnet-5 | runtime ai feature | 1,566 | $0.01 | `d309dffcecbf…` (1 lines) | `c7863af00` `https://s` `runtime:s` |
| 2026-08-12 | SpeakerOps runtime | claude-sonnet-5 | runtime ai feature | 1,565 | $0.01 | `7317f9cec92e…` (1 lines) | `c7863af00` `https://s` `runtime:s` |
| 2026-08-12 | Codex engineering task | gpt-5.6-sol | engineering qa release | 1,247,444 | $0.72 | `a54ed04c544d…` (9990 lines) | `usage/REP` `usage/led` |
| 2026-08-12 | Codex engineering task | gpt-5.6-sol | engineering qa release | 1,096,568 | $0.60 | `86dd32ae4e8c…` (10010 lines) | `seed/seed` `src/web/A` `src/worke` |
| 2026-08-12 | Fable / Opus / Walt build session | claude-fable-5 | planning design engineering | 32,629,800 | $34.28 | `5eabf73a788b…` (5136 lines) | `seed/seed` `src/web/A` `src/worke` |
| 2026-08-12 | Fable / Opus / Walt build session | claude-fable-5 | planning design engineering | 4,184,536 | $4.44 | `cdff7609ba68…` (5343 lines) | `src/worke` |
| 2026-08-12 | Fable / Opus / Walt build session | claude-opus-5 | planning design engineering | 29,800,355 | $22.90 | `cdff7609ba68…` (5343 lines) | `src/worke` |
| 2026-08-12 | Codex engineering task | gpt-5.6-sol | engineering qa release | 5,009,050 | $4.40 | `b2b7c0c4d9d5…` (10235 lines) | `migration` `seed/seed` `src/share` `src/share` `src/share` `src/share` `src/share` `src/share` `src/share` `src/web/l` `src/web/p` `src/web/p` `src/worke` `src/worke` `src/worke` `src/worke` |
| 2026-08-12 | Fable / Opus / Walt build session | claude-fable-5 | planning design engineering | 7,315,809 | $25.20 | `5e28b26dc7dc…` (5485 lines) | `migration` `seed/seed` `src/share` `src/share` `src/share` `src/share` `src/share` `src/share` `src/share` `src/web/l` `src/web/p` `src/web/p` `src/worke` `src/worke` `src/worke` `src/worke` |
| 2026-08-12 | Fable / Opus / Walt build session | claude-opus-5 | planning design engineering | 19,177,453 | $17.86 | `5e28b26dc7dc…` (5485 lines) | `migration` `seed/seed` `src/share` `src/share` `src/share` `src/share` `src/share` `src/share` `src/share` `src/web/l` `src/web/p` `src/web/p` `src/worke` `src/worke` `src/worke` `src/worke` |
| 2026-08-12 | Codex engineering task | gpt-5.6-sol | engineering qa release | 7,003,136 | $4.67 | `c16459f814b1…` (10477 lines) | `migration` `migration` `seed/seed` `src/share` `src/share` `src/share` `src/share` `src/share` `src/web/l` `src/web/p` `src/web/p` `src/web/p` `src/web/p` `src/worke` `src/worke` `src/worke` `src/worke` |
| 2026-08-12 | Codex engineering task | gpt-5.6-sol | engineering qa release | 34,460,964 | $23.26 | `7de507222bed…` (11494 lines) | — |
| 2026-08-12 | Codex engineering task | gpt-5.6-sol | engineering qa release | 1,316,334 | $0.76 | `72a67d28eade…` (11533 lines) | `docs/API.` `docs/EVAL` `migration` `migration` `migration` `src/share` `src/share` `src/share` `src/share` `src/share` `src/share` `src/web/A` `src/web/c` `src/web/c` `src/web/c` `src/web/l` `src/web/p` `src/web/p` `src/web/p` `src/web/p` `src/web/p` `src/web/p` `src/web/p` `src/web/p` `src/web/p` `src/web/p` `src/web/p` `src/web/p` `src/worke` `src/worke` `src/worke` `src/worke` `usage/REP` `usage/led` |
| 2026-08-12 | Codex engineering task | gpt-5.6-sol | engineering qa release | 6,499,248 | $3.74 | `fdc149c6069d…` (11695 lines) | — |
| 2026-08-12 | Codex engineering task | gpt-5.6-sol | engineering qa release | 203,918 | $0.11 | `a9789ae8757e…` (11699 lines) | `usage/REP` `usage/led` |
| 2026-08-12 | Codex engineering task | gpt-5.6-sol | engineering qa release | 6,702,643 | $4.93 | `3cf39ddb5f59…` (12007 lines) | — |
| 2026-08-12 | Codex engineering task | gpt-5.6-sol | engineering qa release | 549,287 | $0.40 | `f704067387a3…` (12029 lines) | `.dev.vars` `README.md` `docs/API.` `src/share` `src/web/c` `src/web/p` `src/worke` `src/worke` `src/worke` `src/worke` `src/worke` `src/worke` `src/worke` `src/worke` `usage/REP` `usage/led` `wrangler.` |
| 2026-08-12 | Codex engineering task | gpt-5.6-sol | engineering qa release | 1,918,243 | $1.14 | `bc3c65b59b99…` (12093 lines) | — |
| 2026-08-12 | Codex engineering task | gpt-5.6-sol | engineering qa release | 153,332 | $0.10 | `57c1398c8296…` (12099 lines) | `usage/REP` `usage/led` |
| 2026-08-12 | Codex engineering task | gpt-5.6-sol | engineering qa release | 4,060,486 | $3.10 | `2d74eb7c3bec…` (12225 lines) | — |
| 2026-08-12 | Codex engineering task | gpt-5.6-sol | engineering qa release | 381,404 | $0.23 | `c6c87f707b65…` (12235 lines) | `usage/REP` `usage/led` `wrangler.` |
| 2026-08-12 | Codex engineering task | gpt-5.6-sol | engineering qa release | 2,773,557 | $1.58 | `445473ea76e2…` (12298 lines) | — |
| 2026-08-12 | Codex engineering task | gpt-5.6-sol | engineering qa release | 206,697 | $0.11 | `b056944da880…` (12302 lines) | `usage/REP` `usage/led` |
| 2026-08-12 | Codex engineering task | gpt-5.6-sol | engineering qa release | 1,889,812 | $1.08 | `4199a7935791…` (12346 lines) | — |
| 2026-08-12 | Codex engineering task | gpt-5.6-sol | engineering qa release | 214,757 | $0.12 | `f4bb069b70b8…` (12352 lines) | `usage/REP` `usage/led` |
| 2026-08-12 | Codex engineering task | gpt-5.6-sol | engineering qa release | 12,989,770 | $8.27 | `7c45382d51d2…` (12811 lines) | `docs/eval` `docs/eval` |
| 2026-08-12 | Fable / Opus / Walt build session | claude-fable-5 | planning design engineering | 28,567,408 | $47.79 | `115b9aa5446a…` (5613 lines) | `docs/eval` `docs/eval` |
| 2026-08-10 | Anthropic API evaluation and product testing | claude-sonnet-5 | product api evaluation | 7,594 | $0.03 | `b142818dbb13…` (6 lines) | `docs/eval` `src/worke` |
| 2026-08-11 | Anthropic API evaluation and product testing | claude-sonnet-5 | product api evaluation | 3,078 | $0.01 | `b142818dbb13…` (6 lines) | `docs/eval` `src/worke` |
| 2026-08-12 | Anthropic API evaluation and product testing | claude-haiku-4-5-20251001 | product api evaluation | 324,791 | $0.10 | `b142818dbb13…` (6 lines) | `docs/eval` `src/worke` |
| 2026-08-12 | Anthropic API evaluation and product testing | claude-opus-5 | product api evaluation | 936,929 | $6.54 | `b142818dbb13…` (6 lines) | `docs/eval` `src/worke` |
| 2026-08-12 | Anthropic API evaluation and product testing | claude-sonnet-5 | product api evaluation | 106,060,065 | $33.36 | `b142818dbb13…` (6 lines) | `docs/eval` `src/worke` |
| 2026-08-12 | Codex engineering task | gpt-5.6-sol | engineering qa release | 6,785,458 | $5.00 | `cccbdb0b546f…` (13101 lines) | — |
| 2026-08-12 | Fable / Opus / Walt build session | claude-fable-5 | planning design engineering | 4,873,346 | $5.05 | `b1fac75e09f4…` (5628 lines) | — |
| 2026-08-12 | Codex engineering task | gpt-5.6-sol | engineering qa release | 1,887,419 | $1.25 | `0780bddb18d2…` (13170 lines) | — |
| 2026-08-12 | Fable / Opus / Walt build session | claude-fable-5 | planning design engineering | 982,838 | $1.24 | `9c75931ec6e4…` (5641 lines) | — |
| 2026-08-12 | Codex engineering task | gpt-5.6-sol | engineering qa release | 2,529,909 | $1.50 | `5f3de2393073…` (13245 lines) | `.gitignor` `README.md` `docs/API.` `docs/SUBM` `scripts/u` `src/share` `src/worke` `usage/REA` `usage/REP` `usage/led` `usage/pri` `usage/rec` |
| 2026-08-12 | Fable / Opus / Walt build session | claude-fable-5 | planning design engineering | 10,261,601 | $11.88 | `7ebb547266f4…` (5731 lines) | `.gitignor` `README.md` `docs/API.` `docs/SUBM` `scripts/u` `src/share` `src/worke` `usage/REA` `usage/REP` `usage/led` `usage/pri` `usage/rec` |
| 2026-08-12 | Fable / Opus / Walt build session | claude-fable-5 | planning design engineering | 6,782,307 | $11.61 | `74152d026cb8…` (6016 lines) | `.dev.vars` `LICENSE` `README.md` `docs/AIRT` `docs/API.` `docs/CRIT` `docs/DEMO` `docs/DEMO` `docs/EVAL` `docs/LIAM` `docs/PRE_` `docs/SELF` `docs/SUBM` `docs/WALK` `index.htm` `package.j` `scripts/r` `scripts/r` `scripts/r` `scripts/r` `scripts/s` `scripts/s` `scripts/s` `scripts/u` `seed/seed` `src/share` `src/share` `src/share` `src/share` `src/share` `src/share` `src/share` `src/share` `src/web/c` `src/web/c` `src/web/l` `src/web/p` `src/web/p` `src/web/p` `src/web/p` `src/web/p` `src/web/p` `src/web/p` `src/web/p` `src/web/p` `src/web/p` `src/web/p` `src/worke` `src/worke` `src/worke` `src/worke` `src/worke` `src/worke` `src/worke` `src/worke` `src/worke` `src/worke` `src/worke` `src/worke` `src/worke` `src/worke` `src/worke` `submissio` `wrangler.` |
| 2026-08-12 | Fable / Opus / Walt build session | claude-fable-5 | planning design engineering | 1,923,621 | $2.49 | `8e2fa33dd6d4…` (6061 lines) | `docs/SUBM` |
| 2026-08-12 | Fable / Opus / Walt build session | claude-fable-5 | planning design engineering | 1,178,062 | $1.41 | `78bae8a878c5…` (6081 lines) | `src/worke` |
| 2026-08-12 | Fable / Opus / Walt build session | claude-fable-5 | planning design engineering | 6,586,167 | $10.79 | `65866f24b11a…` (6229 lines) | `chain-dow` `chain-up.` `docs/CRIT` `package.j` `scripts/r` `scripts/s` `scripts/s` `scripts/u` |
| 2026-08-12 | Fable / Opus / Walt build session | claude-fable-5 | planning design engineering | 203,488 | $0.27 | `5a5806694d08…` (6237 lines) | `.gitignor` |
| 2026-08-12 | Fable / Opus / Walt build session | claude-fable-5 | planning design engineering | 204,104 | $0.25 | `3d3da3acead5…` (6241 lines) | — |
| 2026-08-12 | Fable / Opus / Walt build session | claude-fable-5 | planning design engineering | 8,657,722 | $10.69 | `d598fe17c2ba…` (6394 lines) | `docs/eval` `docs/eval` |
| 2026-08-12 | Fable / Opus / Walt build session | claude-fable-5 | planning design engineering | 7,467,872 | $8.67 | `c45db1e84a32…` (6515 lines) | `docs/eval` `docs/eval` |
| 2026-08-12 | Fable / Opus / Walt build session | claude-fable-5 | planning design engineering | 34,374,239 | $44.02 | `db3bbd5e93a5…` (6906 lines) | `.claude/w` `src/share` `src/share` `src/web/l` `src/web/p` `src/web/p` `src/web/p` `src/web/p` `src/worke` `src/worke` `src/worke` `src/worke` |
| 2026-08-12 | Fable / Opus / Walt build session | claude-fable-5 | planning design engineering | 397,814 | $0.45 | `836fd7756d80…` (6910 lines) | `.gitignor` |
| 2026-08-12 | Fable / Opus / Walt build session | claude-fable-5 | planning design engineering | 1,998,658 | $2.13 | `39f1c5897af8…` (6929 lines) | `src/worke` |
| 2026-08-12 | Fable / Opus / Walt build session | claude-fable-5 | planning design engineering | 8,325,101 | $9.99 | `51e014789268…` (7021 lines) | `scripts/r` `src/web/p` `src/web/p` |
| 2026-08-12 | Fable / Opus / Walt build session | claude-fable-5 | planning design engineering | 5,326,846 | $6.09 | `1022a6e471c6…` (7066 lines) | `docs/SUBM` `docs/WALK` `scripts/r` `src/worke` `submissio` |
| 2026-08-12 | Codex engineering task | gpt-5.6-sol | engineering qa release | 26,507,645 | $17.12 | `cdd2906b7a11…` (13959 lines) | `docs/eval` `docs/eval` |
| 2026-08-12 | Fable / Opus / Walt build session | claude-fable-5 | planning design engineering | 17,227,091 | $26.85 | `db7f341c8c70…` (7232 lines) | `docs/eval` `docs/eval` |
| 2026-08-12 | Fable / Opus / Walt build session | claude-fable-5 | planning design engineering | 5,881,081 | $6.36 | `a5f8e58d9c47…` (7283 lines) | `scripts/u` |
| 2026-08-12 | Codex engineering task | gpt-5.6-sol | engineering qa release | 1,992,532 | $1.64 | `044cd8cf80df…` (14108 lines) | — |
| 2026-08-12 | Fable / Opus / Walt build session | claude-fable-5 | planning design engineering | 1,494,494 | $1.70 | `7c3ce380af68…` (7292 lines) | — |
| 2026-08-12 | Codex engineering task | gpt-5.6-sol | engineering qa release | 1,876,052 | $1.25 | `42aa87529add…` (14197 lines) | `usage/REP` `usage/led` `usage/rec` |
| 2026-08-12 | Codex engineering task | gpt-5.6-sol | engineering qa release | 13,790,207 | $8.46 | `d78aee717265…` (14579 lines) | `README.md` `docs/API.` `docs/EVAL` `docs/SCOR` `docs/WALK` `docs/eval` `migration` `seed/seed` `src/share` `src/web/l` `src/web/p` `src/worke` `src/worke` `src/worke` `src/worke` |
| 2026-08-12 | Fable / Opus / Walt build session | claude-fable-5 | planning design engineering | 2,037,076 | $2.30 | `668f58df7dd1…` (7318 lines) | `README.md` `docs/API.` `docs/EVAL` `docs/SCOR` `docs/WALK` `docs/eval` `migration` `seed/seed` `src/share` `src/web/l` `src/web/p` `src/worke` `src/worke` `src/worke` `src/worke` |
| 2026-08-12 | Codex engineering task | gpt-5.6-sol | engineering qa release | 7,771,999 | $5.13 | `051e71701fce…` (14715 lines) | `src/worke` |
| 2026-08-12 | Codex engineering task | gpt-5.6-sol | engineering qa release | 3,503,898 | $2.27 | `fe7671a8e170…` (14861 lines) | — |
| 2026-08-12 | Codex engineering task | gpt-5.6-sol | engineering qa release | 1,979,355 | $1.30 | `53fd5c00c3fb…` (14949 lines) | `docs/EVAL` `docs/SCOR` `usage/REP` `usage/led` `usage/rec` |
| 2026-08-12 | Codex engineering task | gpt-5.6-sol | engineering qa release | 815,222 | $0.49 | `d6bc214450e9…` (14981 lines) | `scripts/s` |
| 2026-08-12 | Codex engineering task | gpt-5.6-sol | engineering qa release | 1,335,796 | $0.79 | `a7781533711b…` (15029 lines) | `scripts/s` |
| 2026-08-12 | Codex engineering task | gpt-5.6-sol | engineering qa release | 7,254,501 | $4.64 | `1dabfa2eaee0…` (15286 lines) | `docs/USAB` `src/web/p` `src/web/p` |
| 2026-08-12 | Fable / Opus / Walt build session | claude-fable-5 | planning design engineering | 54,824,143 | $77.00 | `f03b61157cde…` (7711 lines) | `docs/USAB` `src/web/p` `src/web/p` |
| 2026-08-12 | Fable / Opus / Walt build session | claude-fable-5 | planning design engineering | 10,332,166 | $22.13 | `39fc66cfc313…` (7801 lines) | `public/og` `scripts/r` `scripts/r` `submissio` |
| 2026-08-12 | Lectern runtime | claude-haiku-4-5-20251001 | runtime ai feature | 1,062 | $0.00 | `eb7051184fdd…` (1 lines) | `e61506d9c` `https://l` `runtime:r` |
| 2026-08-12 | Fable / Opus / Walt build session | claude-fable-5 | planning design engineering | 1,235,802 | $1.32 | `ba7930c06290…` (7807 lines) | `usage/REP` `usage/led` |
| 2026-08-12 | Fable / Opus / Walt build session | claude-fable-5 | planning design engineering | 1,861,012 | $2.04 | `13380ba94717…` (7823 lines) | `index.htm` `public/og` `scripts/r` |
| 2026-08-13 | Fable / Opus / Walt build session | claude-fable-5 | planning design engineering | 18,496,239 | $30.98 | `c2cc4310392c…` (7948 lines) | `src/web/p` |
| 2026-08-13 | Fable / Opus / Walt build session | claude-fable-5 | planning design engineering | 9,220,480 | $9.95 | `35345c9e9804…` (8004 lines) | `src/web/c` `src/web/c` `src/web/c` `src/web/p` `src/web/p` `src/web/p` |
| 2026-08-13 | Fable / Opus / Walt build session | claude-fable-5 | planning design engineering | 6,016,855 | $6.30 | `6960b53c18b1…` (8036 lines) | `src/web/c` |
| 2026-08-13 | Fable / Opus / Walt build session | claude-fable-5 | planning design engineering | 7,479,007 | $20.32 | `01f823ed91dd…` (8082 lines) | `submissio` |
| 2026-08-13 | Codex engineering task | gpt-5.6-sol | engineering qa release | 6,696,292 | $4.79 | `452e80830758…` (15453 lines) | `package.j` `scripts/u` `src/share` `usage/REA` `usage/REP` `usage/rec` |
| 2026-08-13 | Fable / Opus / Walt build session | claude-fable-5 | planning design engineering | 37,012,538 | $39.25 | `b88ca2c3a4b2…` (8298 lines) | `package.j` `scripts/u` `src/share` `usage/REA` `usage/REP` `usage/rec` |
| 2026-08-13 | Codex engineering task | gpt-5.6-sol | engineering qa release | 2,199,708 | $1.20 | `96c4c0f5fbff…` (15488 lines) | `src/web/p` `src/web/p` |
| 2026-08-13 | Fable / Opus / Walt build session | claude-fable-5 | planning design engineering | 9,996,272 | $24.77 | `d082ccc2ab1a…` (8366 lines) | `src/web/p` `src/web/p` |
| 2026-08-13 | Fable / Opus / Walt build session | claude-fable-5 | planning design engineering | 9,397,558 | $24.15 | `9eed3b59575f…` (8426 lines) | `seed/seed` `src/worke` |
| 2026-08-13 | Fable / Opus / Walt build session | claude-fable-5 | planning design engineering | 9,543,359 | $10.25 | `c4410e568478…` (8481 lines) | `src/share` `src/worke` |
| 2026-08-13 | Fable / Opus / Walt build session | claude-fable-5 | planning design engineering | 7,320,280 | $22.52 | `4bd9273dbc74…` (8972 lines) | `docs/BRIE` `migration` `src/share` `src/share` `src/share` `src/share` `src/share` `src/web/l` `src/worke` `src/worke` `src/worke` `src/worke` |
| 2026-08-14 | Fable / Opus / Walt build session | claude-opus-5 | planning design engineering | 75,029,251 | $53.31 | `4bd9273dbc74…` (8972 lines) | `docs/BRIE` `migration` `src/share` `src/share` `src/share` `src/share` `src/share` `src/web/l` `src/worke` `src/worke` `src/worke` `src/worke` |
| 2026-08-14 | Fable / Opus / Walt build session | claude-opus-5 | planning design engineering | 5,776,138 | $3.06 | `bac5172a58cb…` (8999 lines) | `seed/seed` `src/web/A` `src/web/p` `src/web/p` `src/web/p` `src/worke` |
| 2026-08-14 | Fable / Opus / Walt build session | claude-opus-5 | planning design engineering | 33,585,277 | $17.81 | `a87e5652694d…` (9161 lines) | `docs/BRIE` `migration` `src/share` `src/share` `src/share` `src/web/p` `src/web/p` `src/worke` |
| 2026-08-14 | Fable / Opus / Walt build session | claude-opus-5 | planning design engineering | 5,315,839 | $2.87 | `e323dfbc9601…` (9202 lines) | `scripts/m` `src/worke` |
| 2026-08-14 | Fable / Opus / Walt build session | claude-opus-5 | planning design engineering | 1,783,696 | $0.95 | `c737dba8862b…` (9208 lines) | `docs/BRIE` |
| 2026-08-14 | Codex engineering task | gpt-5.6-sol | engineering qa release | 1,133,893 | $2.02 | `31632f74ef8d…` (15586 lines) | `src/web/p` `src/web/p` `src/worke` |
| 2026-08-14 | Fable / Opus / Walt build session | claude-opus-5 | planning design engineering | 5,399,181 | $2.94 | `a5c164927a25…` (9238 lines) | `src/web/p` `src/web/p` `src/worke` |
| 2026-08-14 | Codex engineering task | gpt-5.6-sol | engineering qa release | 24,124,567 | $15.17 | `99649d99ef74…` (16420 lines) | — |
| 2026-08-14 | Lectern runtime | claude-haiku-4-5-20251001 | runtime ai feature | 1,024 | $0.00 | `9b6c0a04394a…` (1 lines) | `ac848eed5` `https://l` `runtime:r` |
| 2026-08-14 | Codex engineering task | gpt-5.6-sol | engineering qa release | 1,741,712 | $1.05 | `ea6cdc8cd899…` (16462 lines) | — |
| 2026-08-14 | Codex engineering task | gpt-5.6-sol | engineering qa release | 542,982 | $0.32 | `e9efa3bdd00d…` (16479 lines) | `docs/FEAT` `usage/REP` `usage/led` `usage/rec` |
| 2026-08-14 | Codex engineering task | gpt-5.6-sol | engineering qa release | 2,575,487 | $1.42 | `34ba377fddb6…` (16536 lines) | `seed/seed` |
| 2026-08-14 | Fable / Opus / Walt build session | claude-opus-5 | planning design engineering | 18,748,904 | $18.28 | `eaf0cc4de947…` (9347 lines) | `seed/seed` `usage/REP` `usage/led` |
| 2026-08-14 | Fable / Opus / Walt build session | claude-opus-5 | planning design engineering | 946,440 | $0.49 | `75292638db2c…` (9349 lines) | `scripts/u` `seed/seed` `src/share` `usage/REP` `usage/led` `usage/rec` |
| 2026-08-14 | Fable / Opus / Walt build session | claude-opus-5 | planning design engineering | 31,083,959 | $25.19 | `7fd2ea5daeaa…` (9474 lines) | `migration` `src/share` `src/share` `src/share` `src/share` `src/worke` `src/worke` `src/worke` `src/worke` |
| 2026-08-14 | Fable / Opus / Walt build session | claude-fable-5 | planning design engineering | 16,582,653 | $24.06 | `b8a0e6c5906c…` (9729 lines) | `migration` `seed/seed` `src/share` `src/share` `src/web/A` `src/web/l` `src/web/p` `src/web/p` `src/web/p` `src/web/p` `src/worke` `src/worke` `src/worke` `src/worke` |
| 2026-08-14 | Fable / Opus / Walt build session | claude-opus-5 | planning design engineering | 993,413 | $0.53 | `b8a0e6c5906c…` (9729 lines) | `migration` `seed/seed` `src/share` `src/share` `src/web/A` `src/web/l` `src/web/p` `src/web/p` `src/web/p` `src/web/p` `src/worke` `src/worke` `src/worke` `src/worke` |

## Receipt allocations

Billing evidence stays in `usage/private/`. The tracked allocation ledger stores only SHA-256 digests, byte sizes, billing period, evidenced amount, and the usage-entry ids covered, preventing the same work or evidence from being claimed twice.

| Billing period | Provider | Evidence label | Evidence class | Actual USD | Usage entries covered | Private evidence |
| --- | --- | --- | --- | ---: | ---: | --- |
| 2026-08-10–2026-08-12 | anthropic | Anthropic API token spend — Aug 10–12, 2026 | API usage statement | $40.13 | 18 | `7aecc47030b3…` (2,470 bytes + 3 supporting receipts) |
| 2026-08-09–2026-09-09 | anthropic | Claude Max subscription — Aug 9–Sep 9, 2026 | subscription receipt | $212.50 | 52 | `a429dcde5cd9…` (34,130 bytes) |
| 2026-07-21–2026-08-21 | openai | ChatGPT Pro subscription — Jul 21–Aug 21, 2026 | subscription receipt | $212.50 | 78 | `920a87c11f8c…` (38,220 bytes) |
| 2026-08-09–2026-09-09 | anthropic | Claude Max subscription — Aug 9–Sep 9, 2026 — coverage extension | coverage extension | $0.00 | 1 | `a429dcde5cd9…` (34,130 bytes) |
| 2026-07-21–2026-08-21 | openai | ChatGPT Pro subscription — Jul 21–Aug 21, 2026 — coverage extension | coverage extension | $0.00 | 1 | `920a87c11f8c…` (38,220 bytes) |
| 2026-08-09–2026-09-09 | anthropic | Claude Max subscription — Aug 9–Sep 9, 2026 — coverage extension | coverage extension | $0.00 | 1 | `a429dcde5cd9…` (34,130 bytes) |
| 2026-07-21–2026-08-21 | openai | ChatGPT Pro subscription — Jul 21–Aug 21, 2026 — coverage extension | coverage extension | $0.00 | 1 | `920a87c11f8c…` (38,220 bytes) |
| 2026-08-09–2026-09-09 | anthropic | Claude Max subscription — Aug 9–Sep 9, 2026 — coverage extension | coverage extension | $0.00 | 1 | `a429dcde5cd9…` (34,130 bytes) |
| 2026-07-21–2026-08-21 | openai | ChatGPT Pro subscription — Jul 21–Aug 21, 2026 — coverage extension | coverage extension | $0.00 | 1 | `920a87c11f8c…` (38,220 bytes) |
| 2026-08-09–2026-09-09 | anthropic | Claude Max subscription — Aug 9–Sep 9, 2026 — coverage extension | coverage extension | $0.00 | 1 | `a429dcde5cd9…` (34,130 bytes) |
| 2026-08-09–2026-09-09 | anthropic | Claude Max subscription — Aug 9–Sep 9, 2026 — coverage extension | coverage extension | $0.00 | 1 | `a429dcde5cd9…` (34,130 bytes) |
| 2026-08-09–2026-09-09 | anthropic | Claude Max subscription — Aug 9–Sep 9, 2026 — coverage extension | coverage extension | $0.00 | 1 | `a429dcde5cd9…` (34,130 bytes) |
| 2026-08-09–2026-09-09 | anthropic | Claude Max subscription — Aug 9–Sep 9, 2026 — coverage extension | coverage extension | $0.00 | 1 | `a429dcde5cd9…` (34,130 bytes) |
| 2026-08-09–2026-09-09 | anthropic | Claude Max subscription — Aug 9–Sep 9, 2026 — coverage extension | coverage extension | $0.00 | 1 | `a429dcde5cd9…` (34,130 bytes) |
| 2026-08-09–2026-09-09 | anthropic | Claude Max subscription — Aug 9–Sep 9, 2026 — coverage extension | coverage extension | $0.00 | 1 | `a429dcde5cd9…` (34,130 bytes) |
| 2026-08-09–2026-09-09 | anthropic | Claude Max subscription — Aug 9–Sep 9, 2026 — coverage extension | coverage extension | $0.00 | 1 | `a429dcde5cd9…` (34,130 bytes) |
| 2026-08-09–2026-09-09 | anthropic | Claude Max subscription — Aug 9–Sep 9, 2026 — coverage extension | coverage extension | $0.00 | 1 | `a429dcde5cd9…` (34,130 bytes) |
| 2026-08-09–2026-09-09 | anthropic | Claude Max subscription — Aug 9–Sep 9, 2026 — coverage extension | coverage extension | $0.00 | 1 | `a429dcde5cd9…` (34,130 bytes) |
| 2026-08-09–2026-09-09 | anthropic | Claude Max subscription — Aug 9–Sep 9, 2026 — coverage extension | coverage extension | $0.00 | 1 | `a429dcde5cd9…` (34,130 bytes) |
| 2026-08-09–2026-09-09 | anthropic | Claude Max subscription — Aug 9–Sep 9, 2026 — coverage extension | coverage extension | $0.00 | 1 | `a429dcde5cd9…` (34,130 bytes) |
| 2026-08-09–2026-09-09 | anthropic | Claude Max subscription — Aug 9–Sep 9, 2026 — coverage extension | coverage extension | $0.00 | 1 | `a429dcde5cd9…` (34,130 bytes) |
| 2026-08-09–2026-09-09 | anthropic | Claude Max subscription — Aug 9–Sep 9, 2026 — coverage extension | coverage extension | $0.00 | 1 | `a429dcde5cd9…` (34,130 bytes) |
| 2026-08-09–2026-09-09 | anthropic | Claude Max subscription — Aug 9–Sep 9, 2026 — coverage extension | coverage extension | $0.00 | 1 | `a429dcde5cd9…` (34,130 bytes) |
| 2026-07-21–2026-08-21 | openai | ChatGPT Pro subscription — Jul 21–Aug 21, 2026 — coverage extension | coverage extension | $0.00 | 1 | `920a87c11f8c…` (38,220 bytes) |
| 2026-08-09–2026-09-09 | anthropic | Claude Max subscription — Aug 9–Sep 9, 2026 — coverage extension | coverage extension | $0.00 | 1 | `a429dcde5cd9…` (34,130 bytes) |
| 2026-08-09–2026-09-09 | anthropic | Claude Max subscription — Aug 9–Sep 9, 2026 — coverage extension | coverage extension | $0.00 | 1 | `a429dcde5cd9…` (34,130 bytes) |
| 2026-07-21–2026-08-21 | openai | ChatGPT Pro subscription — Jul 21–Aug 21, 2026 — coverage extension | coverage extension | $0.00 | 1 | `920a87c11f8c…` (38,220 bytes) |
| 2026-07-21–2026-08-21 | openai | ChatGPT Pro subscription — Jul 21–Aug 21, 2026 — coverage extension | coverage extension | $0.00 | 1 | `920a87c11f8c…` (38,220 bytes) |
| 2026-08-09–2026-09-09 | anthropic | Claude Max subscription — Aug 9–Sep 9, 2026 — coverage extension | coverage extension | $0.00 | 1 | `a429dcde5cd9…` (34,130 bytes) |
| 2026-07-21–2026-08-21 | openai | ChatGPT Pro subscription — Jul 21–Aug 21, 2026 — coverage extension | coverage extension | $0.00 | 1 | `920a87c11f8c…` (38,220 bytes) |
| 2026-07-21–2026-08-21 | openai | ChatGPT Pro subscription — Jul 21–Aug 21, 2026 — coverage extension | coverage extension | $0.00 | 1 | `920a87c11f8c…` (38,220 bytes) |
| 2026-07-21–2026-08-21 | openai | ChatGPT Pro subscription — Jul 21–Aug 21, 2026 — coverage extension | coverage extension | $0.00 | 1 | `920a87c11f8c…` (38,220 bytes) |
| 2026-07-21–2026-08-21 | openai | ChatGPT Pro subscription — Jul 21–Aug 21, 2026 — coverage extension | coverage extension | $0.00 | 1 | `920a87c11f8c…` (38,220 bytes) |
| 2026-07-21–2026-08-21 | openai | ChatGPT Pro subscription — Jul 21–Aug 21, 2026 — coverage extension | coverage extension | $0.00 | 1 | `920a87c11f8c…` (38,220 bytes) |
| 2026-07-21–2026-08-21 | openai | ChatGPT Pro subscription — Jul 21–Aug 21, 2026 — coverage extension | coverage extension | $0.00 | 1 | `920a87c11f8c…` (38,220 bytes) |
| 2026-08-09–2026-09-09 | anthropic | Claude Max subscription — Aug 9–Sep 9, 2026 — coverage extension | coverage extension | $0.00 | 1 | `a429dcde5cd9…` (34,130 bytes) |
| 2026-07-21–2026-08-21 | openai | ChatGPT Pro subscription — Jul 21–Aug 21, 2026 — coverage extension | coverage extension | $0.00 | 1 | `920a87c11f8c…` (38,220 bytes) |
| 2026-08-09–2026-09-09 | anthropic | Claude Max subscription — Aug 9–Sep 9, 2026 — coverage extension | coverage extension | $0.00 | 1 | `a429dcde5cd9…` (34,130 bytes) |
| 2026-08-09–2026-09-09 | anthropic | Claude Max subscription — Aug 9–Sep 9, 2026 — coverage extension | coverage extension | $0.00 | 1 | `a429dcde5cd9…` (34,130 bytes) |
| 2026-08-09–2026-09-09 | anthropic | Claude Max subscription — Aug 9–Sep 9, 2026 — coverage extension | coverage extension | $0.00 | 1 | `a429dcde5cd9…` (34,130 bytes) |
| 2026-08-09–2026-09-09 | anthropic | Claude Max subscription — Aug 9–Sep 9, 2026 — coverage extension | coverage extension | $0.00 | 1 | `a429dcde5cd9…` (34,130 bytes) |
| 2026-08-09–2026-09-09 | anthropic | Claude Max subscription — Aug 9–Sep 9, 2026 — coverage extension | coverage extension | $0.00 | 1 | `a429dcde5cd9…` (34,130 bytes) |
| 2026-08-09–2026-09-09 | anthropic | Claude Max subscription — Aug 9–Sep 9, 2026 — coverage extension | coverage extension | $0.00 | 1 | `a429dcde5cd9…` (34,130 bytes) |
| 2026-08-09–2026-09-09 | anthropic | Claude Max subscription — Aug 9–Sep 9, 2026 — coverage extension | coverage extension | $0.00 | 1 | `a429dcde5cd9…` (34,130 bytes) |
| 2026-08-12–2026-08-13 | anthropic | Anthropic API token spend — incremental Aug 12–13, 2026 | API usage statement | $44.46 | 0 | `21ac01b89c49…` (234,657 bytes) |
| 2026-08-12–2026-08-13 | anthropic | Anthropic API token spend — incremental Aug 12–13, 2026 — coverage extension | coverage extension | $0.00 | 1 | `21ac01b89c49…` (234,657 bytes) |
| 2026-08-09–2026-09-09 | anthropic | Claude Max subscription — Aug 9–Sep 9, 2026 — coverage extension | coverage extension | $0.00 | 1 | `a429dcde5cd9…` (34,130 bytes) |
| 2026-07-21–2026-08-21 | openai | ChatGPT Pro subscription — Jul 21–Aug 21, 2026 — coverage extension | coverage extension | $0.00 | 1 | `920a87c11f8c…` (38,220 bytes) |
| 2026-08-09–2026-09-09 | anthropic | Claude Max subscription — Aug 9–Sep 9, 2026 — coverage extension | coverage extension | $0.00 | 1 | `a429dcde5cd9…` (34,130 bytes) |
| 2026-07-21–2026-08-21 | openai | ChatGPT Pro subscription — Jul 21–Aug 21, 2026 — coverage extension | coverage extension | $0.00 | 1 | `920a87c11f8c…` (38,220 bytes) |
| 2026-08-09–2026-09-09 | anthropic | Claude Max subscription — Aug 9–Sep 9, 2026 — coverage extension | coverage extension | $0.00 | 1 | `a429dcde5cd9…` (34,130 bytes) |
| 2026-08-09–2026-09-09 | anthropic | Claude Max subscription — Aug 9–Sep 9, 2026 — coverage extension | coverage extension | $0.00 | 1 | `a429dcde5cd9…` (34,130 bytes) |
| 2026-08-09–2026-09-09 | anthropic | Claude Max subscription — Aug 9–Sep 9, 2026 — coverage extension | coverage extension | $0.00 | 2 | `a429dcde5cd9…` (34,130 bytes) |
| 2026-08-09–2026-09-09 | anthropic | Claude Max subscription — Aug 9–Sep 9, 2026 — coverage extension | coverage extension | $0.00 | 1 | `a429dcde5cd9…` (34,130 bytes) |
| 2026-08-09–2026-09-09 | anthropic | Claude Max subscription — Aug 9–Sep 9, 2026 — coverage extension | coverage extension | $0.00 | 1 | `a429dcde5cd9…` (34,130 bytes) |
| 2026-08-09–2026-09-09 | anthropic | Claude Max subscription — Aug 9–Sep 9, 2026 — coverage extension | coverage extension | $0.00 | 1 | `a429dcde5cd9…` (34,130 bytes) |
| 2026-08-09–2026-09-09 | anthropic | Claude Max subscription — Aug 9–Sep 9, 2026 — coverage extension | coverage extension | $0.00 | 1 | `a429dcde5cd9…` (34,130 bytes) |
| 2026-08-09–2026-09-09 | anthropic | Claude Max subscription — Aug 9–Sep 9, 2026 — coverage extension | coverage extension | $0.00 | 1 | `a429dcde5cd9…` (34,130 bytes) |
| 2026-07-21–2026-08-21 | openai | ChatGPT Pro subscription — Jul 21–Aug 21, 2026 — coverage extension | coverage extension | $0.00 | 1 | `920a87c11f8c…` (38,220 bytes) |
| 2026-07-21–2026-08-21 | openai | ChatGPT Pro subscription — Jul 21–Aug 21, 2026 — coverage extension | coverage extension | $0.00 | 1 | `920a87c11f8c…` (38,220 bytes) |
| 2026-07-21–2026-08-21 | openai | ChatGPT Pro subscription — Jul 21–Aug 21, 2026 — coverage extension | coverage extension | $0.00 | 1 | `920a87c11f8c…` (38,220 bytes) |
| 2026-07-21–2026-08-21 | openai | ChatGPT Pro subscription — Jul 21–Aug 21, 2026 — coverage extension | coverage extension | $0.00 | 1 | `920a87c11f8c…` (38,220 bytes) |
| 2026-08-09–2026-09-09 | anthropic | Claude Max subscription — Aug 9–Sep 9, 2026 — coverage extension | coverage extension | $0.00 | 1 | `a429dcde5cd9…` (34,130 bytes) |
| 2026-07-21–2026-08-21 | openai | ChatGPT Pro subscription — Jul 21–Aug 21, 2026 — coverage extension | coverage extension | $0.00 | 1 | `920a87c11f8c…` (38,220 bytes) |
| 2026-08-09–2026-09-09 | anthropic | Claude Max subscription — Aug 9–Sep 9, 2026 — coverage extension | coverage extension | $0.00 | 1 | `a429dcde5cd9…` (34,130 bytes) |
| 2026-08-09–2026-09-09 | anthropic | Claude Max subscription — Aug 9–Sep 9, 2026 — coverage extension | coverage extension | $0.00 | 1 | `a429dcde5cd9…` (34,130 bytes) |
| 2026-08-09–2026-09-09 | anthropic | Claude Max subscription — Aug 9–Sep 9, 2026 — coverage extension | coverage extension | $0.00 | 2 | `a429dcde5cd9…` (34,130 bytes) |

## How to audit this

1. `pnpm usage:check` — validates every entry against the schema, recomputes each cost from [pricing.json](pricing.json), rejects duplicate evidence, and confirms this report matches the ledger digest above.
2. `git log --follow usage/ledger.jsonl` — the ledger is append-only; history shows every addition in context.
3. Compare any entry's `sha256` against the raw session log we provide on request; the line count must match.
4. `pnpm usage:receipt -- ...` hashes private subscription or API billing evidence and appends an immutable allocation record; validation rejects duplicate files and overlapping usage-entry coverage.
