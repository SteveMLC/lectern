import { access, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const submission = JSON.parse(await readFile(resolve(root, "submission.json"), "utf8"));
if (submission.schemaVersion !== 1) throw new Error("submission.json must use schemaVersion 1");
const requiredUrls = process.env.REQUIRE_SUBMISSION_URLS === "1";
const requireReceipts = process.env.REQUIRE_RECEIPTS === "1";
const checks = [];
const warnings = [];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    timeout: options.timeout ?? 120_000,
    env: { ...process.env, ...options.env },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim().split(/\r?\n/).slice(-12).join("\n");
    throw new Error(`${command} ${args.join(" ")} failed${output ? `:\n${output}` : ""}`);
  }
  return result.stdout.trim();
}

async function check(name, task) {
  try {
    await task();
    checks.push({ name, ok: true });
  } catch (error) {
    checks.push({ name, ok: false, error: error instanceof Error ? error.message : String(error) });
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

await check("Submission manifest and deadline", async () => {
  for (const field of ["repositoryUrl", "demoUrl", "videoUrl", "deadline"]) {
    assert(typeof submission[field] === "string" && submission[field], `submission.json ${field} is required`);
  }
  const repository = new URL(submission.repositoryUrl);
  const demo = new URL(submission.demoUrl);
  const video = new URL(submission.videoUrl);
  assert(repository.protocol === "https:" && repository.hostname === "github.com", "repositoryUrl must be an HTTPS GitHub URL");
  assert(demo.protocol === "https:" && video.protocol === "https:", "demo and video URLs must use HTTPS");
  const deadline = Date.parse(submission.deadline);
  assert(Number.isFinite(deadline), "submission deadline must be ISO-8601");
  assert(Date.now() < deadline, `submission deadline passed at ${submission.deadline}`);
  assert(submission.reimbursementMaxUsd === 500, "reimbursement cap must match the organizer's $500 brief");
});

await check("Release verification and Cloudflare configuration", async () => {
  run("pnpm", ["release:preflight"]);
});

await check("Strict production and Airtable smoke test", async () => {
  run("pnpm", ["smoke:production"], {
    env: {
      REQUIRE_AIRTABLE: "1",
      SPEAKEROPS_BASE_URL: process.env.SPEAKEROPS_BASE_URL ?? submission.demoUrl,
      SPEAKEROPS_ORGANIZER_PASSCODE: process.env.SPEAKEROPS_ORGANIZER_PASSCODE ?? "speakerops-judge-2026",
    },
  });
});

await check("Public GitHub repository and MIT license", async () => {
  const repositoryPath = new URL(submission.repositoryUrl).pathname.replace(/^\/+|\/+$/g, "");
  const response = await fetch(`https://api.github.com/repos/${repositoryPath}`, {
    headers: { Accept: "application/vnd.github+json", "User-Agent": "speakerops-submission-preflight" },
  });
  assert(response.ok, `GitHub repository lookup returned HTTP ${response.status}`);
  const repository = await response.json();
  assert(repository.private === false, "GitHub repository is not public");
  assert(repository.default_branch === "main", "GitHub default branch is not main");
  assert(repository.license?.spdx_id === "MIT", "GitHub does not detect an MIT license");
});

await check("Clean tree and current commit published on main", async () => {
  const dirty = run("git", ["status", "--porcelain"]);
  if (dirty && process.env.SUBMISSION_ALLOW_DIRTY === "1") warnings.push("Working-tree cleanliness was bypassed for local preflight development.");
  else assert(dirty === "", "working tree is not clean");
  const head = run("git", ["rev-parse", "HEAD"]);
  const remote = run("git", ["ls-remote", "origin", "refs/heads/main"], { timeout: 20_000 }).split(/\s+/)[0];
  assert(head === remote, `HEAD ${head.slice(0, 12)} is not origin/main ${remote.slice(0, 12)}`);
});

await check("Walkthrough media is submission-ready", async () => {
  const candidates = [
    process.env.SPEAKEROPS_WALKTHROUGH_FILE,
    "output/playwright/speakerops-walkthrough-final.mp4",
    "output/playwright/speakerops-walkthrough-submission.mp4",
  ].filter(Boolean);
  let video;
  for (const candidate of candidates) {
    try {
      await access(resolve(root, candidate));
      video = candidate;
      break;
    } catch {}
  }
  assert(video, "no local walkthrough file was found");
  const probe = JSON.parse(run("ffprobe", [
    "-v", "error", "-show_entries", "format=duration:stream=codec_type,codec_name,width,height", "-of", "json", video,
  ], { timeout: 20_000 }));
  const visual = probe.streams?.find((stream) => stream.codec_type === "video");
  const audio = probe.streams?.find((stream) => stream.codec_type === "audio");
  const duration = Number(probe.format?.duration);
  assert(visual?.codec_name === "h264", `walkthrough video codec is ${visual?.codec_name ?? "missing"}, expected h264`);
  assert(visual.width >= 1280 && visual.height >= 720, `walkthrough is ${visual.width}x${visual.height}, expected at least 1280x720`);
  assert(Number.isFinite(duration) && duration > 30 && duration <= 180, `walkthrough duration is ${duration}s, expected 30–180s`);
  const bytes = await readFile(resolve(root, video));
  assert(bytes.length === submission.videoBytes, `walkthrough is ${bytes.length} bytes, expected ${submission.videoBytes}`);
  assert(createHash("sha256").update(bytes).digest("hex") === submission.videoSha256, "walkthrough SHA-256 does not match submission.json");
  assert(Math.abs(duration - submission.videoDurationSeconds) < 0.01, `walkthrough duration does not match submission.json (${submission.videoDurationSeconds}s)`);
  if (!audio) warnings.push(`Walkthrough ${video} has no audio; use the narrated final or record a human voiceover.`);
});

const videoUrl = process.env.SPEAKEROPS_VIDEO_URL ?? submission.videoUrl;
await check("Published walkthrough URL is submission-ready", async () => {
  assert(videoUrl, "no published walkthrough URL is configured");
  const response = await fetch(videoUrl, { method: "HEAD" });
  assert(response.ok, `published walkthrough returned HTTP ${response.status}`);
  assert(response.headers.get("content-type")?.startsWith("video/mp4"), "published walkthrough is not video/mp4");
  assert(Number(response.headers.get("content-length")) > 1_000_000, "published walkthrough content length is unexpectedly small");
  assert(response.headers.get("etag")?.replaceAll('"', "") === submission.videoEtag, "published walkthrough ETag does not match submission.json");
});

await check("Narration and reimbursement audit artifacts", async () => {
  await Promise.all([
    access(resolve(root, "docs/WALKTHROUGH_NARRATION.txt")),
    access(resolve(root, "usage/REPORT.md")),
    access(resolve(root, "usage/ledger.jsonl")),
  ]);
  run("pnpm", ["usage:check"]);
});

await check("Production AI calls are exported to the reimbursement ledger", async () => {
  run("pnpm", ["usage:runtime", "--", "--check", "--quiet"], {
    env: {
      SPEAKEROPS_ORGANIZER_PASSCODE: process.env.SPEAKEROPS_ORGANIZER_PASSCODE ?? "speakerops-judge-2026",
      SPEAKEROPS_BASE_URL: process.env.SPEAKEROPS_BASE_URL ?? submission.demoUrl,
    },
  });
});

let receiptCount = 0;
try {
  const receipts = await readFile(resolve(root, "usage/receipts.jsonl"), "utf8");
  receiptCount = receipts.split(/\r?\n/).filter((line) => line.trim()).length;
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
if (receiptCount === 0) {
  const message = "No provider receipt allocation is recorded; actual reimbursement evidence remains $0 until `pnpm usage:receipt` is run with a real private receipt.";
  if (requireReceipts) checks.push({ name: "Receipt evidence", ok: false, error: message });
  else warnings.push(message);
}

for (const [name, value] of [
  ["organizer submission form", process.env.SPEAKEROPS_SUBMISSION_FORM_URL ?? submission.submissionFormUrl],
  ["uploaded walkthrough", videoUrl],
]) {
  if (!value) {
    const message = `Missing ${name} URL; provide it as ${name === "organizer submission form" ? "SPEAKEROPS_SUBMISSION_FORM_URL" : "SPEAKEROPS_VIDEO_URL"}.`;
    if (requiredUrls) checks.push({ name: `${name} URL`, ok: false, error: message });
    else warnings.push(message);
  } else {
    try { new URL(value); }
    catch { checks.push({ name: `${name} URL`, ok: false, error: `${value} is not a valid URL` }); }
  }
}

for (const item of checks) console.log(`${item.ok ? "PASS" : "FAIL"}  ${item.name}${item.error ? ` — ${item.error}` : ""}`);
for (const warning of warnings) console.log(`WARN  ${warning}`);

const failures = checks.filter((item) => !item.ok);
console.log(`\n${checks.length - failures.length}/${checks.length} submission checks passed; ${warnings.length} warning(s).`);
if (failures.length) process.exit(1);
