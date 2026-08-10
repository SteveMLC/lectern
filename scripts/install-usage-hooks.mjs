import { access } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
await access(resolve(root, ".githooks/pre-commit"));

const result = spawnSync("git", ["config", "core.hooksPath", ".githooks"], {
  cwd: root,
  encoding: "utf8",
});
if (result.status !== 0) {
  console.error(result.stderr || "Unable to configure repository hooks.");
  process.exit(1);
}

console.log("Automatic AI usage capture installed: .githooks/pre-commit runs usage:sync and stages the ledger/report before each commit.");
