import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const args = process.argv.slice(2);
const value = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const approvedUsd = Number(value("--approved-usd"));
const ticket = value("--approval-ticket");
const scenarios = value("--scenarios");
const maxTurns = Number(value("--max-turns"));
const explicitApproval = process.env.LECTERN_PAID_EVAL_APPROVED === "YES_SPEND_API_BUDGET";
const sbekDirectory = process.env.SBEK_DIR;

const problems = [];
if (!explicitApproval) problems.push("set LECTERN_PAID_EVAL_APPROVED=YES_SPEND_API_BUDGET for this one command");
if (!Number.isFinite(approvedUsd) || approvedUsd <= 0 || approvedUsd > 2) {
  problems.push("pass --approved-usd with a positive cap no greater than 2");
}
if (!ticket || !/^[A-Za-z0-9._-]{3,80}$/.test(ticket)) problems.push("pass a non-sensitive --approval-ticket for the spend record");
if (!scenarios || scenarios.includes(",")) problems.push("pass exactly one scenario with --scenarios");
if (!Number.isInteger(maxTurns) || maxTurns < 1 || maxTurns > 20) problems.push("pass --max-turns between 1 and 20");
if (!sbekDirectory) problems.push("set SBEK_DIR to the local eval-kit checkout");

if (problems.length) {
  console.error("Paid evaluation refused:\n- " + problems.join("\n- "));
  console.error("\nFree verification remains: pnpm verify, local browser walks, and sbek --dry-run/rescore.");
  process.exit(1);
}

const commandArgs = args.filter((arg, index) =>
  !["--approved-usd", "--approval-ticket"].includes(arg) &&
  !["--approved-usd", "--approval-ticket"].includes(args[index - 1] ?? ""),
);
console.log(`Approval ${ticket}: ceiling $${approvedUsd.toFixed(2)}; one scenario only: ${scenarios}; max turns: ${maxTurns}.`);
const result = spawnSync("pnpm", ["run", "eval", "--", ...commandArgs], {
  cwd: resolve(sbekDirectory),
  env: process.env,
  stdio: "inherit",
});
process.exit(result.status ?? 1);
