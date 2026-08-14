# Non-negotiable UI and repair ledger

Audited 2026-08-14 against the Google Doc **“$10,0000 Kill My SaaS - Competition Brief”** (`1rBHJtiNKHv4i43tdf2Rm0sDEYuIcajhmAPoBKR_Az-A`) and the live Lectern deployment.

## Required capability paths

| Competition capability | Organizer path | Public / participant path | Status | Evidence |
| --- | --- | --- | --- | --- |
| Conditional CFP forms and category routing | `/admin/submission-forms`, `/admin/settings` | `/e/:slug/cfp` and `/e/:slug/cfp/:formId` | Wired | Multiple calls, per-form questions, conditional rules, windows, capacity, locked fields, and track routing are present. The dashboard maps this path and the sidebar marks it Core. |
| Speaker self-service for profile and files | `/admin/speakers`, `/admin/files`, `/admin/portal-forms` | `/speaker/:token` | Wired | Portal profile, proposal editing, tasks/forms, R2 headshots/slides/documents, versions, and organizer comments are reachable. |
| Templated communications, reminders, calendar invites | `/admin/communications` | Portal and public `.ics` links | Wired | Previews, bulk messages, scheduled reminders, delivery receipts, session and itinerary ICS are present. Local `pnpm dev` now forces simulated delivery. |
| Multi-round evaluation and optional AI assist | `/admin/evaluations`, `/admin/reviews` | `/review/:token` | Wired | Rounds, weighted criteria, scoped queues, assignments, recusal, progress, nudges, CSV, and explicitly gated review-score assist are present. |
| Drag agenda, conflicts, and program views | `/admin/agenda` | `/e/:slug` and schedule embeds | Wired | Room board drag/drop, exact placement, auto-place, room/speaker conflict receipts, list/week views, track/room/day filters, and publish action are visible. |
| Outstanding speaker onboarding dashboard | `/admin` and `/admin/speakers` | `/speaker/:token` | Wired in this closeout | Dashboard now reads the existing organizer-speaker task progress and shows the live open count plus affected speakers. |
| One-way Accelevents integration | `/admin/integrations` | n/a | Optional / not required | The organizer FAQ explicitly rules this integration optional. The existing event-scoped connection record remains visible for teams that choose to configure it, but `awaiting_credentials` is not a completion blocker and no unverified external push is claimed. |
| Speaker resources/wiki with HTML embeds | `/admin/resources` | `/speaker/:token` Resources | Wired in this closeout | The existing `resource_pages` model now has organizer list/create/edit/publish UI and API routes. Multiple published pages are selectable in the portal; embed HTML still passes through the existing sanitizer. |
| Mobile speaker gallery and itinerary | `/admin/embeds` | `/api/embeds/events/:slug/gallery` and `/api/embeds/events/:slug/itinerary` | Wired | Search/filter/detail gallery, saved itinerary, ICS export, responsive layouts, and XML/JSON feeds are present. |

The organizer dashboard repeats this list as a **Non-negotiable workflow map**. Core destinations are also marked in desktop and mobile navigation so a judge can locate them without knowing Lectern’s information architecture.

## Defect closeout

| Defect | Repair | Verification |
| --- | --- | --- |
| CFP answers and confirmation state survived a cross-link to another form | Reset all form-scoped state whenever event slug or form id changes while retaining an authenticated submitter identity | Browser: typed `MUST NOT LEAK` on the primary form, followed the Lightning link, and saw a blank title plus only the Lightning `live_demo` question. |
| Creating a field on a secondary form returned the primary bundle | `D1Repo.createFormField` now reloads with `input.formId` | Local API response returned `form_lightning`, the Lightning title, and its own field keys. |
| New-form close time was interpreted in the browser timezone | Convert `datetime-local` with `zonedLocalInputToIso` and name the event timezone in the field label/help | Browser exposed `Closes at (America/Los_Angeles)`; timezone domain tests pass. |
| Local Resend credentials could cause real delivery | `pnpm dev` forces `EMAIL_DELIVERY_MODE=simulated`, independent of `.dev.vars` | A local direct-recipient send returned `sent_simulated`, `mode: simulated`, and no provider id. |

## Visual evidence

- `output/playwright/non-negotiable-dashboard-full.png`
- `output/playwright/non-negotiable-dashboard-mobile-full.png`
- `output/playwright/core-navigation-mobile.png`
- `output/playwright/speaker-portal-resources.png`

The desktop and 390 px passes show no overlapping controls or clipped Core paths. The production baseline was also walked read-only: agenda views/conflicts/publishing, speaker operations, communications, embeds, and Airtable were reachable; resources administration, onboarding work on the dashboard, Core markers, and the Accelevents connection were not visible before this closeout.

No paid model/evaluation calls and no production email were used for this audit.
