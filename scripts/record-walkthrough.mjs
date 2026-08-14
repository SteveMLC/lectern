/**
 * Records the submission walkthrough against the LIVE deployment with
 * Playwright's built-in screen capture, then transcodes to the H.264 source
 * the narrator (`pnpm walkthrough:narrate`) expects.
 *
 * Every interaction is wrapped so a missed selector never kills the take —
 * the scene simply dwells on the page and the recording continues. Scene
 * timings are fixed so the narration script can be written to the beats.
 *
 *   node scripts/record-walkthrough.mjs
 *   LECTERN_BASE_URL / LECTERN_ORGANIZER_PASSCODE override the defaults.
 */
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { chromium } from "playwright";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const outDir = resolve(root, "output/playwright");
const baseUrl = process.env.LECTERN_BASE_URL ?? "https://lectern.lectern-go7.workers.dev";
const passcode = process.env.LECTERN_ORGANIZER_PASSCODE ?? "lectern-judge-2026";
const finalSource = resolve(outDir, "lectern-walkthrough-submission.mp4");

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: outDir, size: { width: 1280, height: 720 } },
});
const page = await context.newPage();
page.setDefaultTimeout(4000);

const startedAt = Date.now();
const log = (label) => console.log(`[${((Date.now() - startedAt) / 1000).toFixed(1)}s] ${label}`);
const dwell = (ms) => page.waitForTimeout(ms);
/** Hold the timeline: waits until the walkthrough clock reaches `seconds`. */
async function until(seconds) {
  const remaining = seconds * 1000 - (Date.now() - startedAt);
  if (remaining > 0) await page.waitForTimeout(remaining);
}
async function attempt(label, action) {
  try {
    await action();
    log(`ok: ${label}`);
  } catch (error) {
    log(`skip: ${label} (${error.message?.split("\n")[0] ?? error})`);
  }
}

// Scene 1 — landing (0-6s)
await attempt("landing", () => page.goto(`${baseUrl}/`, { waitUntil: "networkidle" }));
await until(6);

// Scene 2 — public event page (6-22s)
await attempt("event page", () => page.goto(`${baseUrl}/e/horizon-2026`, { waitUntil: "networkidle" }));
await dwell(4000);
await attempt("scroll program", () => page.mouse.wheel(0, 900));
await dwell(3500);
await attempt("scroll gallery", () => page.mouse.wheel(0, 900));
await dwell(3000);
await attempt("scroll top", () => page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" })));
await until(22);

// Scene 3 — CFP with recovery card, conditional field, co-presenter (22-72s)
await attempt("cfp page", () => page.goto(`${baseUrl}/e/horizon-2026/cfp`, { waitUntil: "networkidle" }));
await dwell(2500);
await attempt("show recovery card", () => page.getByRole("button", { name: "Email me my links" }).click());
await dwell(2200);
await attempt("hide recovery card", () => page.getByRole("button", { name: "Close" }).click());
await attempt("name", () => page.getByLabel("Full name", { exact: false }).first().fill("Rosa Delgado"));
await attempt("email", () => page.locator("#email").fill("rosa@fielddata.example"));
await attempt("company", () => page.locator("#company").fill("Fielddata"));
await attempt("role", () => page.locator("#role").fill("Staff Engineer"));
await dwell(1200);
await attempt("title", () => page.getByLabel("Title", { exact: false }).first().fill("Evals That Survive Contact With Production"));
await attempt("abstract", () => page.getByLabel("Abstract", { exact: false }).first().fill(
  "A practical tour of the eval harness we run against every release: what broke, what the judge caught that we missed, and the checks that finally made the score move.",
));
await dwell(1500);
await attempt("track", async () => {
  const select = page.getByLabel("Track", { exact: false }).first();
  await select.selectOption({ index: 1 });
});
await attempt("format workshop", async () => {
  const select = page.getByLabel("Format", { exact: false }).first();
  await select.selectOption("workshop");
});
await dwell(2000); // the conditional field appears on camera
await attempt("workshop length (conditional)", async () => {
  const select = page.getByLabel("Preferred workshop length", { exact: false }).first();
  await select.selectOption({ index: 1 });
});
await attempt("speaking experience", async () => {
  const select = page.getByLabel("Speaking experience", { exact: false }).first();
  await select.selectOption({ index: 1 });
});
await dwell(1200);
await attempt("add co-presenter", () => page.getByRole("button", { name: "Add co-presenter" }).click());
await attempt("co name", () => page.locator("#co-name-0").fill("Marcus Okafor"));
await attempt("co email", () => page.locator("#co-email-0").fill("marcus@cloudreach.example"));
await attempt("co role label", () => page.locator("#co-role-0").fill("Co-author"));
await dwell(1500);
await attempt("scroll to submit", () => page.mouse.wheel(0, 1400));
await dwell(1200);
await attempt("submit proposal", () => page.getByRole("button", { name: /Submit proposal/i }).click());
// The confirmation shows the SUB-n reference and a ten-second countdown, then
// walks the speaker into their portal on camera. Let the whole beat play.
await dwell(12000);
await until(72);

// Scene 4 — organizer console via passcode (72-84s)
await attempt("admin gate", () => page.goto(`${baseUrl}/admin`, { waitUntil: "networkidle" }));
await dwell(1500);
await attempt("passcode", async () => {
  const input = page.getByPlaceholder("Passcode");
  await input.fill(passcode, { timeout: 8000 });
  await input.press("Enter");
});
await dwell(3500);
await until(84);

// Scene 5 — reviews: the new proposal, note, decision, drafted email (84-114s)
await attempt("reviews", () => page.goto(`${baseUrl}/admin/reviews`, { waitUntil: "networkidle" }));
await dwell(3000);
await dwell(3000); // the newest proposal renders first, inline
await attempt("approve", () => page.getByRole("button", { name: "Approve" }).first().click({ timeout: 6000 }));
await dwell(2000);
await attempt("committee note", () => page.getByPlaceholder(/loved the live-demo angle/).first()
  .fill("Strong fit for the AI engineering track; the production-eval angle is exactly what this audience asks for."));
await dwell(2500);
await attempt("draft acceptance email", () => page.getByRole("button", { name: "Draft acceptance email" }).click({ timeout: 8000 }));
await dwell(4500);
await attempt("deliver & approve", () => page.getByRole("button", { name: /Deliver &/i }).click({ timeout: 15000 }));
await dwell(2500);
await until(114);

// Scene 6 — several calls side by side (114-132s)
await attempt("submission forms", () => page.goto(`${baseUrl}/admin/submission-forms`, { waitUntil: "networkidle" }));
await dwell(5000);
await attempt("lightning public form", () => page.goto(`${baseUrl}/e/horizon-2026/cfp/form_lightning`, { waitUntil: "networkidle" }));
await dwell(4000);
await attempt("portal forms", () => page.goto(`${baseUrl}/admin/portal-forms`, { waitUntil: "networkidle" }));
await dwell(4500);
await until(132);

// Scene 7 — agenda: slot it, publish, notify, then Week and Conflicts (132-166s)
await attempt("agenda", () => page.goto(`${baseUrl}/admin/agenda`, { waitUntil: "networkidle" }));
await dwell(3500);
await attempt("auto-place", () => page.getByRole("button", { name: /Auto-place unscheduled/i }).click({ timeout: 6000 }));
await dwell(3000);
await attempt("publish agenda", () => page.getByRole("button", { name: /(Re)?[Pp]ublish agenda/ }).click({ timeout: 6000 }));
await dwell(3000);
await attempt("week view", () => page.getByRole("button", { name: "Week", exact: true }).click({ timeout: 8000 }));
await dwell(4500);
await attempt("conflicts view", () => page.getByRole("button", { name: /^Conflicts/ }).click({ timeout: 8000 }));
await dwell(4500);
// Notify last: the composer takes over the page, so it closes the scene.
await attempt("back to board", () => page.getByRole("button", { name: "Room board", exact: true }).first().click({ timeout: 5000 }));
await dwell(800);
await attempt("notify speakers", () => page.getByText(/Notify speakers/i).first().click({ timeout: 5000 }));
await dwell(3000);
await until(166);

// Scene 8 — public schedule with track/format pills (166-178s). The schedule
// lives on the event page's program explorer; there is no /schedule route.
await attempt("public schedule", () => page.goto(`${baseUrl}/e/horizon-2026`, { waitUntil: "networkidle" }));
await dwell(2500);
await attempt("scroll to program", () => page.mouse.wheel(0, 900));
await dwell(2500);
await attempt("scroll schedule rows", () => page.mouse.wheel(0, 500));
await until(178);

// Scene 9 — the speaker's own portal, incl. the hotel form task (178-194s)
await attempt("speaker portal", () => page.goto(`${baseUrl}/speaker/spk_dana`, { waitUntil: "networkidle" }));
await dwell(4000);
await attempt("scroll portal tasks", () => page.mouse.wheel(0, 900));
await dwell(4000);
await attempt("scroll portal form", () => page.mouse.wheel(0, 600));
await until(194);

// Scene 10 — files + communications receipts (194-204s)
await attempt("files", () => page.goto(`${baseUrl}/admin/files`, { waitUntil: "networkidle" }));
await dwell(4500);
await attempt("communications", () => page.goto(`${baseUrl}/admin/communications`, { waitUntil: "networkidle" }));
await dwell(3500);
await until(204);

// Scene 11 — close on the landing page (204-208s)
await attempt("closing landing", () => page.goto(`${baseUrl}/`, { waitUntil: "networkidle" }));
await until(208);

const video = page.video();
await context.close();
const rawPath = video ? await video.path() : null;
await browser.close();
if (!rawPath) throw new Error("Playwright produced no video file.");
log(`raw capture: ${rawPath}`);

const transcode = spawnSync("ffmpeg", [
  "-y", "-v", "error", "-i", rawPath,
  "-vf", "scale=1280:720:flags=lanczos,fps=30",
  "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p",
  "-an", "-movflags", "+faststart", finalSource,
], { cwd: root, encoding: "utf8", timeout: 300_000 });
if (transcode.status !== 0) throw new Error(`ffmpeg transcode failed: ${transcode.stderr}`);
console.log(`Walkthrough source ready: ${finalSource}`);
