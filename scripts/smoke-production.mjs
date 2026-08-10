const baseUrl = (process.env.SPEAKEROPS_BASE_URL ?? "https://speakerops.speakerops-go7.workers.dev").replace(/\/$/, "");
const passcode = process.env.SPEAKEROPS_ORGANIZER_PASSCODE;
const requireAirtable = process.env.REQUIRE_AIRTABLE === "1";
const checks = [];
const warnings = [];

async function get(path, { auth = false, kind = "json" } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      headers: auth && passcode ? { Authorization: `Bearer ${passcode}` } : {},
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}`);
    return kind === "json" ? response.json() : response.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function check(name, run) {
  try {
    await run();
    checks.push({ name, ok: true });
  } catch (error) {
    checks.push({ name, ok: false, error: error instanceof Error ? error.message : String(error) });
  }
}

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

await check("Worker, D1, and R2 health", async () => {
  const health = await get("/api/health");
  assert(health.ok === true, "health.ok is not true");
  assert(health.checks?.db === true, "D1 health check failed");
  assert(health.checks?.r2Bound === true, "R2 binding is unavailable");
});

await check("Landing page and agent-readable handoff", async () => {
  const [home, llms, demo] = await Promise.all([
    get("/", { kind: "text" }),
    get("/llms.txt", { kind: "text" }),
    get("/demo", { kind: "text" }),
  ]);
  assert(home.includes("SpeakerOps"), "landing page is missing the product name");
  assert(llms.includes("SpeakerOps") && llms.includes("horizon-2026"), "/llms.txt is missing the judging handoff");
  assert(demo.includes('id="passcode-form"'), "demo passcode is not wrapped in a semantic form");
  assert(demo.includes('autocomplete="current-password"'), "demo passcode is missing autocomplete metadata");
});

await check("Public schedule, sessions, and speakers", async () => {
  const [schedule, sessions, speakers] = await Promise.all([
    get("/api/public/events/horizon-2026/schedule"),
    get("/api/public/events/horizon-2026/sessions"),
    get("/api/public/events/horizon-2026/speakers"),
  ]);
  assert(schedule.event?.slug === "horizon-2026" && schedule.slots?.length > 0, "public schedule is empty");
  assert(sessions.sessions?.length > 0, "public sessions are empty");
  assert(speakers.speakers?.length > 0, "public speakers are empty");
  assert(!JSON.stringify(speakers).includes("@"), "public speaker payload appears to expose an email address");
});

await check("Embeds and calendar handoff", async () => {
  const [schedule, sessions, speakers, calendar] = await Promise.all([
    get("/api/embeds/events/horizon-2026/schedule", { kind: "text" }),
    get("/api/embeds/events/horizon-2026/sessions", { kind: "text" }),
    get("/api/embeds/events/horizon-2026/speakers", { kind: "text" }),
    get("/api/public/events/horizon-2026/sessions/ses_from_sub_agents_prod/calendar.ics", { kind: "text" }),
  ]);
  for (const [name, html] of [["schedule", schedule], ["sessions", sessions], ["speakers", speakers]]) {
    assert(html.includes("<!doctype html>") && html.includes("Horizon Dev Summit 2026"), `${name} embed is not a complete event document`);
  }
  assert(calendar.startsWith("BEGIN:VCALENDAR") && calendar.includes("BEGIN:VEVENT") && calendar.includes("END:VCALENDAR"), "calendar download is invalid");
});

if (!passcode) {
  warnings.push("Set SPEAKEROPS_ORGANIZER_PASSCODE to include organizer and Airtable checks.");
} else {
  await check("Organizer counts", async () => {
    const counts = await get("/api/events/horizon-2026/counts", { auth: true });
    assert(counts.submissions > 0 && counts.sessions > 0 && counts.speakers > 0, "organizer dataset is incomplete");
  });

  await check("Airtable integration status", async () => {
    const airtable = await get("/api/integrations/airtable/status", { auth: true });
    assert(airtable.fallback === "d1", "D1 fallback is not declared");
    assert(airtable.minimumRequestSpacingMs >= 200, "Airtable rate protection is not reported");
    if (!airtable.connected) {
      const message = "Airtable is not connected in production; add AIRTABLE_TOKEN and AIRTABLE_BASE_ID before bonus judging.";
      if (requireAirtable) throw new Error(message);
      warnings.push(message);
    }
  });
}

for (const item of checks) console.log(`${item.ok ? "PASS" : "FAIL"}  ${item.name}${item.error ? ` — ${item.error}` : ""}`);
for (const warning of warnings) console.log(`WARN  ${warning}`);

const failures = checks.filter((item) => !item.ok);
console.log(`\n${checks.length - failures.length}/${checks.length} production checks passed at ${baseUrl}.`);
if (failures.length) process.exit(1);
