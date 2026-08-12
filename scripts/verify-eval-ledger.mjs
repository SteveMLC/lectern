import { readFile } from "node:fs/promises";

const ledgerUrl = new URL("../docs/EVAL_GAP_LEDGER.md", import.meta.url);
const ledger = await readFile(ledgerUrl, "utf8");

const requiredRanges = {
  CFP: 18,
  ABS: 14,
  SPK: 16,
  CNT: 14,
  AIA: 8,
  EMB: 16,
};
const expected = Object.entries(requiredRanges).flatMap(([prefix, count]) =>
  Array.from({ length: count }, (_, index) => `${prefix}-${String(index + 1).padStart(2, "0")}`),
);
const rows = [...ledger.matchAll(/^\| ((?:CFP|ABS|SPK|CNT|AIA|EMB)-\d{2}) \|[^\n]+$/gm)];
const found = rows.map((match) => match[1]);
const duplicates = [...new Set(found.filter((id, index) => found.indexOf(id) !== index))];
const missing = expected.filter((id) => !found.includes(id));
const unexpected = found.filter((id) => !expected.includes(id));
const invalidStatus = rows
  .filter((match) => !/\*\*(?:FIXED(?: \(preserved\))?|PARTIAL|PARKED)\*\*/.test(match[0]))
  .map((match) => match[1]);

const problems = [];
if (rows.length !== expected.length) problems.push(`expected ${expected.length} required rows, found ${rows.length}`);
if (missing.length) problems.push(`missing: ${missing.join(", ")}`);
if (duplicates.length) problems.push(`duplicated: ${duplicates.join(", ")}`);
if (unexpected.length) problems.push(`unexpected: ${unexpected.join(", ")}`);
if (invalidStatus.length) problems.push(`missing a FIXED/PARTIAL/PARKED decision: ${invalidStatus.join(", ")}`);

if (problems.length) {
  console.error("Evaluation requirement ledger is incomplete:\n- " + problems.join("\n- "));
  process.exit(1);
}

const statusCounts = { FIXED: 0, PARTIAL: 0, PARKED: 0 };
for (const match of rows) {
  const status = match[0].match(/\*\*(FIXED|PARTIAL|PARKED)/)?.[1];
  if (status) statusCounts[status] += 1;
}
console.log(
  `Evaluation ledger complete: ${expected.length}/${expected.length} required items ` +
    `(${statusCounts.FIXED} fixed, ${statusCounts.PARTIAL} partial, ${statusCounts.PARKED} parked).`,
);
