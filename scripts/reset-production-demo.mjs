import { spawnSync } from "node:child_process";

const baseUrl = (process.env.SPEAKEROPS_BASE_URL ?? "https://speakerops.speakerops-go7.workers.dev").replace(/\/$/, "");
const passcode = process.env.SPEAKEROPS_ORGANIZER_PASSCODE;
const eventSlug = process.env.SPEAKEROPS_EVENT_SLUG ?? "horizon-2026";

if (!passcode) {
  throw new Error("Set SPEAKEROPS_ORGANIZER_PASSCODE before resetting production.");
}

const headers = { Authorization: `Bearer ${passcode}` };

async function request(path, init = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: { ...headers, ...(init.headers ?? {}) },
      signal: controller.signal,
    });
    const body = await response.json();
    if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}: ${JSON.stringify(body)}`);
    return body;
  } finally {
    clearTimeout(timeout);
  }
}

function run(command, args, env = process.env) {
  const result = spawnSync(command, args, { cwd: process.cwd(), env, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} exited with ${result.status}`);
}

// Fail before touching D1 unless Airtable can enumerate live SpeakerOps IDs.
// That capability is what lets the post-reset sync rebuild mappings without
// creating duplicate remote rows.
const before = await request("/api/airtable/status");
if (!before.configured || !before.reachable || !before.recordReadAvailable) {
  throw new Error(
    "Production reset refused before mutation: Airtable must be reachable with data.records:read. " +
      "Add the scope to the existing token, then retry.",
  );
}

const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
run(pnpm, ["db:seed:remote"]);

const sync = await request(`/api/airtable/events/${encodeURIComponent(eventSlug)}/sync?dedupe=1&prune=1`, {
  method: "POST",
});
if (!sync.ok || !sync.reconciliationReadAvailable) {
  throw new Error(`Airtable reconciliation failed after reset: ${JSON.stringify(sync)}`);
}

run(process.execPath, ["scripts/smoke-production.mjs"], {
  ...process.env,
  SPEAKEROPS_BASE_URL: baseUrl,
  SPEAKEROPS_ORGANIZER_PASSCODE: passcode,
  REQUIRE_AIRTABLE: "1",
});

console.log(
  `Production demo reset is clean: ${sync.updated} mirrored, ${sync.relinked} relinked, ` +
    `${sync.duplicatesRemoved} duplicate and ${sync.orphansRemoved} orphan Airtable row(s) removed.`,
);
