import { appendFile, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { basename, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const ledgerPath = resolve(root, "usage/ledger.jsonl");
const pricingPath = resolve(root, "usage/pricing.json");
const tokenKeys = ["uncachedInput", "cacheRead", "cacheWrite", "cacheWrite5m", "cacheWrite1h", "output", "reasoningOutput", "providerTotal"];

function parseJsonl(text, label) {
  return text.split(/\r?\n/).map((line, index) => ({ line, index: index + 1 })).filter(({ line }) => line.trim()).map(({ line, index }) => {
    try { return JSON.parse(line); }
    catch (error) { throw new Error(`${label}:${index}: ${error.message}`); }
  });
}

async function readLedger() {
  return parseJsonl(await readFile(ledgerPath, "utf8"), "usage/ledger.jsonl");
}

async function readPricing() {
  return JSON.parse(await readFile(pricingPath, "utf8"));
}

function asInt(value) {
  const number = Number(value ?? 0);
  if (!Number.isSafeInteger(number) || number < 0) throw new Error(`Invalid token value: ${value}`);
  return number;
}

function normalizeTokens(tokens = {}) {
  return Object.fromEntries(tokenKeys.map((key) => [key, asInt(tokens[key])]));
}

export function estimateCost(tokens, rate) {
  const t = normalizeTokens(tokens);
  const dollars = t.uncachedInput * (rate.uncachedInput ?? 0)
    + t.cacheRead * (rate.cacheRead ?? 0)
    + t.cacheWrite * (rate.cacheWrite ?? 0)
    + t.cacheWrite5m * (rate.cacheWrite5m ?? rate.cacheWrite ?? 0)
    + t.cacheWrite1h * (rate.cacheWrite1h ?? rate.cacheWrite ?? 0)
    + t.output * (rate.output ?? 0);
  return Number((dollars / 1_000_000).toFixed(6));
}

export function validateEntry(entry, rates, seen = new Set()) {
  const errors = [];
  const requireText = (path, value) => {
    if (typeof value !== "string" || value.trim() === "") errors.push(`${path} is required`);
  };
  if (entry.schemaVersion !== 1) errors.push("schemaVersion must be 1");
  requireText("id", entry.id);
  if (seen.has(entry.id)) errors.push(`duplicate id ${entry.id}`);
  seen.add(entry.id);
  if (Number.isNaN(Date.parse(entry.recordedAt))) errors.push("recordedAt must be ISO-8601");
  if (Number.isNaN(Date.parse(entry.period?.start)) || Number.isNaN(Date.parse(entry.period?.end))) errors.push("period start/end must be ISO-8601");
  requireText("actor.name", entry.actor?.name);
  requireText("actor.surface", entry.actor?.surface);
  requireText("provider", entry.provider);
  requireText("model", entry.model);
  requireText("category", entry.category);
  requireText("description", entry.description);
  if (!["provider_reported", "estimated", "manual"].includes(entry.measurement)) errors.push("measurement must be provider_reported, estimated, or manual");
  try { normalizeTokens(entry.tokens); }
  catch (error) { errors.push(error.message); }
  requireText("source.kind", entry.source?.kind);
  requireText("source.sessionId", entry.source?.sessionId);
  if (!/^[a-f0-9]{64}$/.test(entry.source?.sha256 ?? "")) errors.push("source.sha256 must be a SHA-256 digest");
  if (!Number.isSafeInteger(entry.source?.lineCount) || entry.source.lineCount < 1) errors.push("source.lineCount must be positive");
  if (entry.source?.rawEvidence !== "retained_privately") errors.push("source.rawEvidence must be retained_privately");
  const rate = rates[entry.cost?.rateId];
  if (!rate) errors.push(`unknown cost.rateId ${entry.cost?.rateId}`);
  else {
    if (rate.provider !== entry.provider || rate.model !== entry.model) errors.push("rate provider/model mismatch");
    const expected = estimateCost(entry.tokens, rate);
    if (Math.abs(expected - entry.cost.estimatedUsd) > 0.000001) errors.push(`estimatedUsd ${entry.cost.estimatedUsd} does not match ${expected}`);
  }
  if (entry.cost?.actualBilledUsd !== null && (!Number.isFinite(entry.cost.actualBilledUsd) || entry.cost.actualBilledUsd < 0)) errors.push("actualBilledUsd must be null or non-negative");
  return errors;
}

function addTokens(left, right) {
  const a = normalizeTokens(left);
  const b = normalizeTokens(right);
  return Object.fromEntries(tokenKeys.map((key) => [key, a[key] + b[key]]));
}

function subtractTokens(current, previous = {}) {
  const a = normalizeTokens(current);
  const b = normalizeTokens(previous);
  const delta = Object.fromEntries(tokenKeys.map((key) => [key, a[key] - b[key]]));
  for (const [key, value] of Object.entries(delta)) {
    if (value < 0) throw new Error(`Source counter ${key} went backwards; start a new source session instead of overwriting evidence.`);
  }
  return delta;
}

function sourceDigest(text) {
  return createHash("sha256").update(text).digest("hex");
}

function modelRateId(provider, model) {
  const known = {
    "anthropic:claude-fable-5": "anthropic-claude-fable-5-2026-08-10",
    "anthropic:claude-opus-5": "anthropic-claude-opus-5-2026-08-10",
    "openai:gpt-5.6-sol": "openai-gpt-5.6-sol-2026-08-10",
    "openai:gpt-5.5": "openai-gpt-5.5-2026-08-10",
  };
  const rateId = known[`${provider}:${model}`];
  if (!rateId) throw new Error(`No pinned price for ${provider}:${model}; add one to usage/pricing.json first.`);
  return rateId;
}

function cliArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const part = argv[index];
    if (part === "--") continue;
    if (!part.startsWith("--")) continue;
    const key = part.slice(2);
    if (key === "dry-run") options.dryRun = true;
    else options[key.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = argv[++index];
  }
  return options;
}

function inWindow(timestamp, options) {
  return (!options.since || timestamp >= options.since) && (!options.until || timestamp <= options.until);
}

export function parseClaude(records, options = {}) {
  const unique = new Map();
  for (const record of records) {
    if (record.type !== "assistant" || !record.message?.usage || !inWindow(record.timestamp, options)) continue;
    unique.set(record.message.id, record);
  }
  const groups = new Map();
  for (const record of unique.values()) groups.set(record.message.model, [...(groups.get(record.message.model) ?? []), record]);
  return [...groups.entries()].map(([model, rows]) => {
    const tokens = rows.reduce((sum, row) => {
      const usage = row.message.usage;
      return addTokens(sum, {
        uncachedInput: usage.input_tokens,
        cacheRead: usage.cache_read_input_tokens,
        cacheWrite5m: usage.cache_creation?.ephemeral_5m_input_tokens,
        cacheWrite1h: usage.cache_creation?.ephemeral_1h_input_tokens,
        output: usage.output_tokens,
        providerTotal: (usage.input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0) + (usage.output_tokens ?? 0),
      });
    }, {});
    const timestamps = rows.map((row) => row.timestamp).sort();
    return { provider: "anthropic", model, calls: rows.length, tokens, start: timestamps[0], end: timestamps.at(-1) };
  });
}

export function parseCodex(records, options = {}) {
  const counters = records.filter((record) => record.type === "event_msg" && record.payload?.type === "token_count" && record.payload?.info?.total_token_usage && inWindow(record.timestamp, options));
  const last = counters.at(-1);
  if (!last) return [];
  const usage = last.payload.info.total_token_usage;
  const model = records.filter((record) => record.type === "turn_context" && record.payload?.model).at(-1)?.payload.model;
  const cached = asInt(usage.cached_input_tokens);
  const cacheWrite = asInt(usage.cache_write_input_tokens);
  return [{
    provider: "openai",
    model,
    calls: null,
    tokens: normalizeTokens({
      uncachedInput: asInt(usage.input_tokens) - cached - cacheWrite,
      cacheRead: cached,
      cacheWrite,
      output: usage.output_tokens,
      reasoningOutput: usage.reasoning_output_tokens,
      providerTotal: usage.total_tokens,
    }),
    start: records[0]?.timestamp,
    end: last.timestamp,
  }];
}

export function parseOpenClaw(records, options = {}) {
  const rows = records.filter((record) => record.type === "message" && record.message?.role === "assistant" && record.message?.usage?.totalTokens > 0 && inWindow(record.timestamp, options));
  const groups = new Map();
  for (const row of rows) groups.set(row.message.model, [...(groups.get(row.message.model) ?? []), row]);
  return [...groups.entries()].map(([model, modelRows]) => ({
    provider: "openai",
    model,
    calls: modelRows.length,
    tokens: modelRows.reduce((sum, row) => addTokens(sum, {
      uncachedInput: row.message.usage.input,
      cacheRead: row.message.usage.cacheRead,
      cacheWrite: row.message.usage.cacheWrite,
      output: row.message.usage.output,
      providerTotal: row.message.usage.totalTokens,
    }), {}),
    start: modelRows[0].timestamp,
    end: modelRows.at(-1).timestamp,
  }));
}

async function snapshot(options) {
  if (!options.format || !options.file || !options.actor || !options.surface || !options.description || !options.category) throw new Error("snapshot requires --format, --file, --actor, --surface, --description, and --category");
  const raw = await readFile(resolve(options.file), "utf8");
  const records = parseJsonl(raw, basename(options.file));
  const parsers = { claude: parseClaude, codex: parseCodex, openclaw: parseOpenClaw };
  const parser = parsers[options.format];
  if (!parser) throw new Error("--format must be claude, codex, or openclaw");
  const sessionId = options.sessionId
    ?? records.find((record) => record.type === "session_meta")?.payload?.id
    ?? records.find((record) => record.sessionId)?.sessionId
    ?? basename(options.file).match(/[0-9a-f]{8}-[0-9a-f-]{27,}/)?.[0];
  if (!sessionId) throw new Error("Could not derive source session id; pass --session-id");
  const existing = await readLedger();
  const pricing = await readPricing();
  const parsed = parser(records, options);
  const now = new Date().toISOString();
  const sha256 = sourceDigest(raw);
  const lineCount = raw.split(/\r?\n/).filter(Boolean).length;
  const commits = options.commits ? options.commits.split(",").filter(Boolean) : [];
  const artifacts = options.artifacts ? options.artifacts.split(",").filter(Boolean) : [];
  const entries = [];
  for (const item of parsed) {
    const prior = existing.filter((entry) => entry.source.sessionId === sessionId && entry.model === item.model).at(-1);
    const tokens = subtractTokens(item.tokens, prior?.source?.cumulative);
    const priorCalls = prior?.source?.cumulative?.calls ?? 0;
    const calls = item.calls === null ? null : item.calls - priorCalls;
    if (Object.values(tokens).every((value) => value === 0) && (calls === null || calls === 0)) continue;
    const rateId = modelRateId(item.provider, item.model);
    const idHash = createHash("sha256").update(`${sessionId}:${item.model}:${JSON.stringify(item.tokens)}`).digest("hex").slice(0, 12);
    entries.push({
      schemaVersion: 1,
      id: `usage-${now.slice(0, 10).replaceAll("-", "")}-${item.model}-${idHash}`,
      recordedAt: now,
      period: { start: prior?.period?.end ?? item.start, end: item.end },
      actor: { name: options.actor, surface: options.surface },
      provider: item.provider,
      model: item.model,
      category: options.category,
      description: options.description,
      measurement: "provider_reported",
      calls,
      tokens,
      cost: { kind: "api_list_price_estimate", rateId, estimatedUsd: estimateCost(tokens, pricing.rates[rateId]), actualBilledUsd: null, receiptStatus: "pending_subscription_receipt" },
      source: {
        kind: `${options.format}_jsonl`,
        sessionId,
        sha256,
        lineCount,
        rawEvidence: "retained_privately",
        ...(options.since || options.until ? { filter: { since: options.since, until: options.until } } : {}),
        cumulative: { calls: item.calls, ...item.tokens },
      },
      commits,
      artifacts,
      notes: ["Generated by scripts/usage-ledger.mjs; raw evidence remains private."],
    });
  }
  if (!options.dryRun && entries.length) await appendFile(ledgerPath, `${entries.map((entry) => JSON.stringify(entry)).join("\n")}\n`);
  console.log(JSON.stringify(entries, null, 2));
}

async function check() {
  const [entries, pricing] = await Promise.all([readLedger(), readPricing()]);
  const seen = new Set();
  const failures = entries.flatMap((entry, index) => validateEntry(entry, pricing.rates, seen).map((message) => `line ${index + 1}: ${message}`));
  if (failures.length) throw new Error(`Usage ledger failed validation:\n- ${failures.join("\n- ")}`);
  console.log(`Usage ledger valid: ${entries.length} entries, ${seen.size} unique evidence records.`);
}

async function summary() {
  const entries = await readLedger();
  const totals = new Map();
  let estimated = 0;
  let actual = 0;
  let pending = 0;
  for (const entry of entries) {
    const key = `${entry.provider}/${entry.model}`;
    const row = totals.get(key) ?? { calls: 0, entries: 0, tokens: normalizeTokens(), estimated: 0 };
    row.calls += entry.calls ?? 0;
    row.entries += 1;
    row.tokens = addTokens(row.tokens, entry.tokens);
    row.estimated += entry.cost.estimatedUsd;
    totals.set(key, row);
    estimated += entry.cost.estimatedUsd;
    if (entry.cost.actualBilledUsd === null) pending += 1;
    else actual += entry.cost.actualBilledUsd;
  }
  console.log("# AI usage reimbursement summary\n");
  console.log("| Provider / model | Entries | Calls | Input | Cache reads | Cache writes | Output | API-equivalent USD |");
  console.log("| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |");
  for (const [key, row] of totals) {
    const writes = row.tokens.cacheWrite + row.tokens.cacheWrite5m + row.tokens.cacheWrite1h;
    console.log(`| ${key} | ${row.entries} | ${row.calls || "—"} | ${row.tokens.uncachedInput.toLocaleString()} | ${row.tokens.cacheRead.toLocaleString()} | ${writes.toLocaleString()} | ${row.tokens.output.toLocaleString()} | $${row.estimated.toFixed(2)} |`);
  }
  console.log(`\nAPI-equivalent estimate: **$${estimated.toFixed(2)}**.`);
  console.log(`Actual billed spend evidenced so far: **$${actual.toFixed(2)}**. Receipt/subscription proof pending on ${pending} entries.`);
  console.log("\nThe estimate is a workload gauge, not a reimbursement claim. Use invoices or subscription receipts for the actual claim.");
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  if (command === "check") return check();
  if (command === "summary") return summary();
  if (command === "snapshot") return snapshot(cliArgs(rest));
  throw new Error("Usage: usage-ledger.mjs <check|summary|snapshot>");
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
