# Demo speaker headshots

Drop an image in here named after the speaker id and it becomes that speaker's
headshot everywhere: the public speaker gallery embed, the organizer roster,
and the review queue. Delete them all and every surface falls back to initials
tiles — nothing breaks, nothing renders as a broken image.

## Naming

The filename **is** the speaker id from `seed/seed.sql`:

| File | Speaker | Role |
|------|---------|------|
| `spk_ada.jpg` | Ada Okafor | Principal Engineer, Nimbus Labs · Lagos / Remote |
| `spk_dana.jpg` | Dana Whitfield | CTO, Aurora Compute · Denver |
| `spk_lin.jpg` | Lin Zhao | Staff Engineer, Nimbus Labs · Vancouver |
| `spk_omar.jpg` | Omar Haddad | Moderator, Stack Parliament · Amsterdam |
| `spk_priya.jpg` | Priya Sharma | Co-founder, Evalworks · Bengaluru |

Optional — these three have submitted but are not yet on the program, so they
only appear in the review queue: `spk_tom.jpg` (Tom Ostrander, PlainSignal),
`spk_marco.jpg` (Marco Reyes, Ferrostack), `spk_yuki.jpg` (Yuki Tanaka,
Typecraft).

`.jpg`, `.jpeg`, `.png`, and `.webp` are all accepted.

## What the images should be

- **Square**, 400×400 to 600×600. They render in a circle at 48px, so anything
  larger is wasted bytes and anything non-square gets centre-cropped.
- **Under ~120KB each.** They live in git and load in an iframe gallery.
- Head-and-shoulders, plain or softly blurred background, face centred and
  filling most of the frame — a conference headshot, not a full-body shot.
- Neutral professional lighting; avoid heavy filters, text overlays, watermarks,
  or logos.

**These are fictional people at a fictional conference, so the portraits must
be generated or otherwise unencumbered.** Do not use photos of real people:
this is a public demo, and nobody in it consented to being a speaker at Horizon
Dev Summit 2026. Vary apparent age, gender, and ethnicity across the set so the
gallery looks like a real conference lineup rather than five variations of one
person, and match the locations above where it reads naturally.

## How they ship

`pnpm db:seed:local` and `pnpm db:seed:remote` both run
`scripts/seed-headshots.mjs` after the SQL seed. That uploads each file to R2
under `speakers/<id>/seed/headshot.<ext>` and writes the matching
`speaker_assets` row — the same pair a real speaker upload produces, so the
demo exercises the real code path. Re-running is safe; the production demo
reset picks them up automatically.
