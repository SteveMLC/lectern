import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const wranglerConfig = await readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8");
const problems = [];

const databaseId = wranglerConfig.match(/"database_id"\s*:\s*"([^"]+)"/)?.[1];
if (!databaseId || databaseId === "00000000-0000-0000-0000-000000000000") {
  problems.push("Replace the placeholder D1 database_id in wrangler.jsonc.");
}

if (!/"bucket_name"\s*:\s*"speakerops-assets"/.test(wranglerConfig)) {
  problems.push('Configure the R2 bucket binding as "speakerops-assets" in wrangler.jsonc.');
}

const whoami = spawnSync("pnpm", ["exec", "wrangler", "whoami"], {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
});
if (whoami.status !== 0 || /not authenticated/i.test(`${whoami.stdout}\n${whoami.stderr}`)) {
  problems.push("Authenticate Wrangler with `pnpm exec wrangler login`.");
}

if (problems.length > 0) {
  console.error("\nProduction release is not configured:\n");
  for (const problem of problems) console.error(`- ${problem}`);
  console.error("\nAfter resolving these items, set ORGANIZER_PASSCODE, migrate, seed, and deploy.");
  process.exit(1);
}

console.log("Production release configuration is ready for remote migration and deployment.");
