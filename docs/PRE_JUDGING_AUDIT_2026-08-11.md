> **Note (2026-08-12):** the product was renamed **Lectern** later this day; names and URLs in this dated record describe the pre-rename deployment.

# SpeakerOps pre-judging hostile audit — 2026-08-11

## Verdict

No P0 or P1 issue was found. The live `/llms.txt` chain completed on desktop and at a
390 px viewport, the README fresh-clone path worked from zero state, organizer routes
held their auth boundary, and hostile content stayed inert across every tested render
and export seam. The remaining unfixed items are presentation or developer-experience
issues, not demo blockers.

## Ranked findings

| Rank | Severity | Location | One-line reproduction | Status |
| --- | --- | --- | --- | --- |
| 1 | P2 — medium | `src/web/lib/sanitizeEmbedHtml.test.ts:1` | Run `pnpm test` in a fresh clone: all 165 tests pass, but Happy DOM prints red `DOMException` network/abort stderr while parsing the deliberately hostile iframe cases at lines 7, 41, and 74. | **Not fixed.** The existing environment option does not suppress parser-side iframe diagnostics, and changing the sanitizer/test environment was not a two-minute, zero-risk diff. |
| 2 | P2 — medium | `src/web/pages/admin/Communications.tsx:183` | Send a schedule notice to one speaker: production confirmed `Audit Judge 0052 now know their slot.` | **Fixed.** The confirmation now selects `knows` for one recipient and `know` for several. |
| 3 | P2 — medium | `docs/DEMO_SCRIPT.md:111`, `docs/LIAM-QA-GUIDE.md:51`, `README.md:66`, `src/worker/routes/llms.ts:65` | Compare the recording/tester/local-setup claims with the live product and a clean clone: real email is not an env-var flip, the seeded checklist has a recording release rather than an AV-check task, and first setup is documented but not one command. | **Fixed.** Claims now match the deliberately simulated-email design, derived task definitions, and actual clone procedure. |
| 4 | P2 — medium | `README.md:182`, `docs/API.md:3`, `src/worker/routes/api.ts:342` | Compare the API prose with the route sweep: speaker tokens and asset ids are capability links, and the live mirror uses `/api/airtable/*`; calling all of those ordinary public routes blurred a meaningful boundary. | **Fixed.** Docs now name speaker/asset capability access and point to the live mirror status/sync routes. |
| 5 | P3 — low | `src/web/pages/admin/Reviews.tsx:89`, `src/web/pages/admin/Agenda.tsx:254` | Open Reviews and a room with one scheduled item: the live build showed `proposal(s)` and `1 sessions`. | **Fixed.** Counts now use normal singular/plural copy. |
| 6 | P3 — low | `src/web/pages/admin/Reviews.tsx:263`, `src/web/pages/SpeakerPortal.tsx:202`, `src/web/pages/SpeakerPortal.tsx:229` | Inspect the accessibility tree: committee notes collapsed into `Ines Farrowaccept...`, every task button was only `Mark complete`, and file links collapsed filename and kind. | **Fixed.** Spoken punctuation and task/file-specific accessible names were added without changing the visual UI. |
| 7 | P3 — low | `src/web/pages/admin/Reviews.tsx:201` | Submit a near-2,000-character abstract locally and open Reviews: it remains safe and does not overflow, but one proposal dominates several screens of the queue. | **Not fixed.** Truncation/expansion is a product behavior choice, outside the behavior-preserving polish fence. |
| 8 | P3 — low | `src/worker/routes/api.ts:345`, `src/worker/index.ts:19` | Compare `/api/docs` with the route sweep: the compact list omits `/api/admin/ping`, `/api/admin/ai-usage`, and the separately mounted `/api/demo/*` and `/api/airtable/*` routes. | **Not fixed.** The high-value links are documented in README and dedicated docs; making this response an exhaustive cross-router manifest is broader than a tiny copy correction. |

## Live judge walk

Tested against `https://speakerops.speakerops-go7.workers.dev` from `/llms.txt`:

- Workshop selection exposed the required conditional length field; an empty value was
  rejected inline, and a valid 90-minute selection submitted.
- Denial from blunt internal notes produced an editable `claude-sonnet-5` feedback
  draft, persisted a committee note, and recorded a simulated send.
- Reversing the same proposal to accepted produced an editable acceptance with the
  correct portal link and four derived onboarding tasks, then created exactly one
  lineage session.
- Exact placement deliberately raised the seeded conflict count from 2 to 4; dragging
  only the audit session into Workshop Studio returned the count to 2 and persisted the
  new room.
- `Notify speakers` guaranteed `Wednesday, October 14 · 10:00 AM – 10:45 AM PDT` and
  `Workshop Studio` in the notice. Simulated delivery persisted.
- The downloaded `.ics` used UTC `17:00–17:45`, the correct room, a stable UID, escaped
  text, and valid folded content lines.
- A direct sponsor keynote was created without a submission and scheduled on day 2.
- The speaker portal persisted a profile edit, completed one task, uploaded a harmless
  text document to R2, and exposed it as an asset record.
- Schedule/session/speaker embeds reflected both audit sessions and the edited public
  speaker profile. `/demo`, `/docs`, `/api-docs`, `/api/docs`, `/api/health`, the public
  walkthrough, and the GitHub repository all returned HTTP 200.
- Reviews and Agenda remained usable at 390 px, the mobile organizer menu worked,
  document width did not overflow the viewport, and the browser reported zero console
  errors or warnings.
- Production Airtable proof remained connected at 8/8 tables, 53 mirrored records,
  successful last sync, and reconciliation-ready reset safety.

### Production records created by this audit

Per the handoff, these records were left in place and production was **not reset**:

- Speaker: `Audit Judge 0052` (`spk_cz7fjsen3bnz`),
  `audit-judge-0052@example.com`.
- CFP submission: `Audit: Conditional Fields Under Pressure`
  (`sub_g71672je5rf7`), finally accepted.
- Derived session: `ses_from_sub_g71672je5rf7`, October 14, 10:00–10:45 AM PDT,
  Workshop Studio.
- Direct session: `Audit Direct Sponsor Session 0052` (`ses_02c6mjsdwpch`), October
  15, 9:00–9:45 AM PDT, Main Hall.
- Asset: `audit-speaker-notes.txt` (`asset_0cqf394069tn`), kind `document`.
- One rejection note/draft/send, one acceptance note/draft/send, one schedule-notice
  draft/send, one profile edit, and one completed onboarding task.

## Fresh-clone truth

Cloned `https://github.com/SteveMLC/speakerops` into
`/tmp/speakerops-audit.5dgaYJ/speakerops` and followed README verbatim:

- `pnpm install` completed from the lockfile.
- `.dev.vars.example` copied as documented.
- Local migrations `0001_init.sql` and `0002_ai_usage_events.sql` applied.
- The deterministic seed executed successfully.
- `pnpm dev` built the SPA and started a healthy local Worker. It selected port 8788
  because 8787 was already occupied and printed the actual URL.
- The default `speakerops-dev` organizer passcode unlocked the local console.
- `pnpm test` passed 19 files and 165 tests. The stderr noise is finding 1 above.

## Content-safety probes

A local CFP record carried script tags, an `img onerror`, quotes, formula prefixes,
RTL text, emoji, and a 1,985-character abstract. Results:

- React cards and ARIA labels rendered literal text; no injected image/script nodes
  appeared and no sentinel global executed.
- Decision reasoning containing `</textarea><script>…` stayed literal in both the
  organizer note and editable email textareas.
- CSV prefixed formula-leading title and company cells with an apostrophe while keeping
  quotes and long text in the correct columns.
- Public schedule/session/speaker iframes escaped the hostile title, abstract, bio, and
  speaker name; all three frame documents had zero hostile scripts/images and no
  sentinel execution.
- A mocked hostile `/api/demo/status` response rendered literal dataset name/key/slug
  text; attribute, focus, image, and script sentinels all remained unset.
- The 12 sanitizer tests passed for scripts, event handlers, `javascript:`/`data:` URLs,
  `srcdoc`, form/object/embed/style removal, safe links, safe images, nested attacks,
  and forced iframe sandbox/referrer policy.

## Auth sweep

All routes in `src/worker/routes/*.ts` were reviewed. Organizer routes in `api.ts`
carry `organizerAuth`; `airtableApi` and `demoApi` apply it to `*`. Speaker portal
reads/writes use the path token as their capability. Public mutations are limited to
CFP intake, and public event/agenda/embed JSON contains no email keys.

Representative unauthenticated local checks returned 401 for submissions, counts,
agenda, runtime AI usage, Airtable status/sync, demo status/load, direct session
creation, and simulated communications. Public event bundle, schedule, sessions, and
speakers returned successfully with zero `email` keys. No auth exception was found.

## Verification

`pnpm verify` passed on branch `codex/polish-audit`:

- usage ledger: 69 valid entries, 69 unique evidence records, report current;
- TypeScript: web and Worker projects passed;
- tests: 19 files, 165 tests passed;
- production SPA build: 147 modules transformed;
- Wrangler: deployment dry-run read five asset files and exited at `--dry-run` without
  deploying or mutating remote data.

