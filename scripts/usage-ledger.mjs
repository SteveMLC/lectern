import { appendFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { basename, resolve } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const ledgerPath = resolve(root, "usage/ledger.jsonl");
const receiptsPath = resolve(root, "usage/receipts.jsonl");
const pricingPath = resolve(root, "usage/pricing.json");
const reportPath = resolve(root, "usage/REPORT.md");
const sourcesPath = resolve(root, "usage/private/sources.json");
const runtimeEvidencePath = resolve(root, "usage/private/runtime-ai-usage.json");
const defaultRuntimeUrl = "https://speakerops.speakerops-go7.workers.dev";
const defaultSourceRoots = {
  codex: "~/.codex/sessions",
  claude: "~/.claude/projects",
  openclaw: "~/.openclaw/agents",
};
const tokenKeys = ["uncachedInput", "cacheRead", "cacheWrite", "cacheWrite5m", "cacheWrite1h", "output", "reasoningOutput", "providerTotal"];

function parseJsonl(text, label) {
  return text.split(/\r?\n/).map((line, index) => ({ line, index: index + 1 })).filter(({ line }) => line.trim()).map(({ line, index }) => {
    try { return JSON.parse(line); }
    catch (error) { throw new Error(`${label}:${index}: ${error.message}`); }
  });
}

function lineCanAffectUsage(line, format) {
  if (format === "claude") return /"type"\s*:\s*"assistant"/.test(line);
  if (format === "openclaw") return /"type"\s*:\s*"message"/.test(line);
  if (format === "codex") {
    return /"type"\s*:\s*"session_meta"/.test(line)
      || /"type"\s*:\s*"turn_context"/.test(line)
      || (/"type"\s*:\s*"event_msg"/.test(line) && /"type"\s*:\s*"token_count"/.test(line));
  }
  return true;
}

export async function readJsonlEvidence(filePath, label, options = {}) {
  const digest = createHash("sha256");
  const records = [];
  let carry = Buffer.alloc(0);
  let lineCount = 0;
  let physicalLine = 0;

  const processLine = (bytes) => {
    physicalLine += 1;
    const normalized = bytes.at(-1) === 13 ? bytes.subarray(0, -1) : bytes;
    if (normalized.length === 0) return;
    lineCount += 1;
    const line = normalized.toString("utf8");
    const timestamp = line.match(/"timestamp"\s*:\s*"([^"]+)"/)?.[1];
    if (timestamp && !inWindow(timestamp, options)) return;
    if ((options.since || options.until) && !timestamp && options.sessionId) return;
    if (!lineCanAffectUsage(line, options.format)) return;
    try {
      records.push(JSON.parse(line));
    } catch (error) {
      throw new Error(`${label}:${physicalLine}: ${error.message}`);
    }
  };

  for await (const chunk of createReadStream(filePath)) {
    digest.update(chunk);
    const data = carry.length ? Buffer.concat([carry, chunk]) : chunk;
    let start = 0;
    for (let newline = data.indexOf(10, start); newline !== -1; newline = data.indexOf(10, start)) {
      processLine(data.subarray(start, newline));
      start = newline + 1;
    }
    carry = start < data.length ? Buffer.from(data.subarray(start)) : Buffer.alloc(0);
  }
  if (carry.length) processLine(carry);

  return { records, sha256: digest.digest("hex"), lineCount };
}

async function readLedger() {
  return parseJsonl(await readFile(ledgerPath, "utf8"), "usage/ledger.jsonl");
}

async function readReceipts() {
  try {
    return parseJsonl(await readFile(receiptsPath, "utf8"), "usage/receipts.jsonl");
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
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

export function validateReceipt(receipt, entries, seen = new Set(), covered = new Set()) {
  const errors = [];
  const requireText = (path, value) => {
    if (typeof value !== "string" || value.trim() === "") errors.push(`${path} is required`);
  };
  if (receipt.schemaVersion !== 1) errors.push("schemaVersion must be 1");
  requireText("id", receipt.id);
  if (seen.has(receipt.id)) errors.push(`duplicate receipt id ${receipt.id}`);
  seen.add(receipt.id);
  if (Number.isNaN(Date.parse(receipt.recordedAt))) errors.push("recordedAt must be ISO-8601");
  const periodStart = Date.parse(receipt.period?.start);
  const periodEnd = Date.parse(receipt.period?.end);
  if (Number.isNaN(periodStart) || Number.isNaN(periodEnd)) errors.push("period start/end must be ISO-8601");
  else if (periodEnd < periodStart) errors.push("period end must not precede period start");
  requireText("provider", receipt.provider);
  requireText("label", receipt.label);
  if (!Number.isFinite(receipt.amountUsd) || receipt.amountUsd <= 0) errors.push("amountUsd must be positive");
  if (receipt.receiptStatus !== "evidenced_subscription_receipt") errors.push("receiptStatus must be evidenced_subscription_receipt");
  if (receipt.source?.kind !== "provider_receipt") errors.push("source.kind must be provider_receipt");
  if (!/^[a-f0-9]{64}$/.test(receipt.source?.sha256 ?? "")) errors.push("source.sha256 must be a SHA-256 digest");
  if (!Number.isSafeInteger(receipt.source?.bytes) || receipt.source.bytes < 1) errors.push("source.bytes must be positive");
  if (receipt.source?.rawEvidence !== "retained_privately") errors.push("source.rawEvidence must be retained_privately");
  if (!Array.isArray(receipt.coversEntryIds) || receipt.coversEntryIds.length === 0) errors.push("coversEntryIds must identify at least one usage entry");
  for (const id of receipt.coversEntryIds ?? []) {
    const entry = entries.find((candidate) => candidate.id === id);
    if (!entry) errors.push(`unknown covered usage entry ${id}`);
    else if (entry.provider !== receipt.provider) errors.push(`covered entry ${id} has provider ${entry.provider}, expected ${receipt.provider}`);
    else if (entry.cost?.actualBilledUsd !== null) errors.push(`covered entry ${id} already has actual billed spend recorded`);
    if (covered.has(id)) errors.push(`usage entry ${id} is covered by more than one receipt`);
    covered.add(id);
  }
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

export function selectRateId(pricing, provider, model, at = new Date().toISOString()) {
  const atDay = at.slice(0, 10);
  const candidates = Object.entries(pricing.rates)
    .filter(([, rate]) => rate.provider === provider && rate.model === model && rate.effectiveAt <= atDay)
    .sort(([, left], [, right]) => right.effectiveAt.localeCompare(left.effectiveAt));
  if (!candidates.length) {
    throw new Error(`No pinned price for ${provider}:${model} on ${atDay}; add a dated entry to usage/pricing.json. No code change is required.`);
  }
  return candidates[0][0];
}

function expandLocalPath(path) {
  if (path === "~") return homedir();
  if (path.startsWith("~/")) return resolve(homedir(), path.slice(2));
  return resolve(root, path);
}

async function findSessionFile(directory, sessionId, format) {
  const matches = [];
  const visit = async (current) => {
    let entries;
    try { entries = await readdir(current, { withFileTypes: true }); }
    catch (error) {
      if (error.code === "ENOENT") return;
      throw error;
    }
    for (const entry of entries) {
      const path = resolve(current, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.name.includes(sessionId) && entry.name.includes(".jsonl")) {
        if (format !== "openclaw" || !entry.name.includes(".trajectory")) matches.push(path);
      }
    }
  };
  await visit(directory);
  if (matches.length === 0) {
    const error = new Error(`No local JSONL file found for session ${sessionId} under ${directory}.`);
    error.code = "ENOENT";
    throw error;
  }
  if (format === "openclaw") {
    const live = matches.find((path) => basename(path) === `${sessionId}.jsonl`);
    if (live) return live;
    const reset = matches
      .filter((path) => basename(path).includes(".jsonl.reset."))
      .sort((left, right) => right.localeCompare(left))[0];
    if (reset) return reset;
  }
  if (matches.length > 1) throw new Error(`Multiple local JSONL files match session ${sessionId}; set an explicit private file path.`);
  return matches[0];
}

async function resolveSourceFile(source) {
  if (source.file) return expandLocalPath(source.file);
  if (!source.sessionId) throw new Error("A source needs either file or sessionId.");
  const sourceRoot = source.searchRoot ?? defaultSourceRoots[source.format];
  if (!sourceRoot) throw new Error(`No default search root for format ${source.format}; set searchRoot or file.`);
  return findSessionFile(expandLocalPath(sourceRoot), source.sessionId, source.format);
}

function stagedArtifacts() {
  const result = spawnSync("git", ["diff", "--cached", "--name-only", "--diff-filter=ACMR"], {
    cwd: root,
    encoding: "utf8",
  });
  if (result.status !== 0) return [];
  return result.stdout.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
}

function cliArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const part = argv[index];
    if (part === "--") continue;
    if (!part.startsWith("--")) continue;
    const key = part.slice(2);
    if (key === "dry-run") options.dryRun = true;
    else if (key === "quiet") options.quiet = true;
    else if (key === "check") options.check = true;
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

export function runtimeEventToEntry(event, pricing, options = {}) {
  const provider = typeof event?.provider === "string" ? event.provider : "";
  const model = typeof event?.model === "string" ? event.model : "";
  const requestId = typeof event?.provider_request_id === "string" ? event.provider_request_id : "";
  const purpose = typeof event?.purpose === "string" ? event.purpose : "";
  const occurredAt = typeof event?.occurred_at === "string" ? event.occurred_at : "";
  const sha256 = typeof event?.evidence_sha256 === "string" ? event.evidence_sha256 : "";
  if (!provider || !model || !requestId || !purpose || Number.isNaN(Date.parse(occurredAt))) {
    throw new Error("Runtime AI event is missing provider, model, request id, purpose, or a valid timestamp.");
  }
  if (!/^[a-f0-9]{64}$/.test(sha256)) throw new Error(`Runtime AI event ${requestId} has an invalid evidence SHA-256.`);
  if (event.measurement !== "provider_reported") throw new Error(`Runtime AI event ${requestId} is not provider-reported evidence.`);

  const input = asInt(event.input_tokens);
  const cacheCreation = asInt(event.cache_creation_input_tokens);
  const cacheWrite5m = asInt(event.cache_creation_5m_input_tokens);
  const cacheWrite1h = asInt(event.cache_creation_1h_input_tokens);
  if (cacheWrite5m + cacheWrite1h > cacheCreation) {
    throw new Error(`Runtime AI event ${requestId} has cache-write details larger than its total.`);
  }
  const cacheRead = asInt(event.cache_read_input_tokens);
  const output = asInt(event.output_tokens);
  const tokens = normalizeTokens({
    uncachedInput: input,
    cacheRead,
    cacheWrite: cacheCreation - cacheWrite5m - cacheWrite1h,
    cacheWrite5m,
    cacheWrite1h,
    output,
    providerTotal: input + cacheCreation + cacheRead + output,
  });
  const rateId = selectRateId(pricing, provider, model, occurredAt);
  const idHash = createHash("sha256").update(`${provider}:${requestId}`).digest("hex").slice(0, 12);
  return {
    schemaVersion: 1,
    id: `usage-${occurredAt.slice(0, 10).replaceAll("-", "")}-runtime-${idHash}`,
    recordedAt: options.recordedAt ?? new Date().toISOString(),
    period: { start: occurredAt, end: occurredAt },
    actor: { name: "SpeakerOps runtime", surface: options.surface ?? defaultRuntimeUrl },
    provider,
    model,
    category: "runtime_ai_feature",
    description: purpose,
    measurement: "provider_reported",
    calls: 1,
    tokens,
    cost: {
      kind: "api_list_price_estimate",
      rateId,
      estimatedUsd: estimateCost(tokens, pricing.rates[rateId]),
      actualBilledUsd: null,
      receiptStatus: "pending_provider_invoice",
    },
    source: {
      kind: "speakerops_runtime_d1",
      sessionId: requestId,
      sha256,
      lineCount: 1,
      rawEvidence: "retained_privately",
      cumulative: { calls: 1, ...tokens },
    },
    commits: options.commit ? [options.commit] : [],
    artifacts: [options.surface ?? defaultRuntimeUrl, `runtime:${purpose}`],
    notes: ["Exported from privacy-safe SpeakerOps D1 counters; prompts, reviewer notes, and generated content were never stored."],
  };
}

async function runtime(options = {}) {
  const baseUrl = (options.url ?? process.env.SPEAKEROPS_BASE_URL ?? defaultRuntimeUrl).replace(/\/$/, "");
  const passcode = options.passcode ?? process.env.SPEAKEROPS_ORGANIZER_PASSCODE;
  if (!passcode) throw new Error("runtime requires --passcode or SPEAKEROPS_ORGANIZER_PASSCODE");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  let response;
  try {
    response = await fetch(`${baseUrl}/api/admin/ai-usage`, {
      headers: { Authorization: `Bearer ${passcode}` },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) throw new Error(`Runtime AI usage export returned HTTP ${response.status}.`);
  const payload = await response.json();
  if (payload?.schemaVersion !== 1 || !Array.isArray(payload.events)) {
    throw new Error("Runtime AI usage export did not return the expected schema.");
  }

  const [existing, pricing] = await Promise.all([readLedger(), readPricing()]);
  const existingRuntimeIds = new Set(existing
    .filter((entry) => entry.source?.kind === "speakerops_runtime_d1")
    .map((entry) => `${entry.provider}:${entry.source.sessionId}`));
  const commitResult = spawnSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" });
  const commit = commitResult.status === 0 ? commitResult.stdout.trim() : undefined;
  const recordedAt = new Date().toISOString();
  const entries = payload.events
    .filter((event) => !existingRuntimeIds.has(`${event.provider}:${event.provider_request_id}`))
    .map((event) => runtimeEventToEntry(event, pricing, { surface: baseUrl, commit, recordedAt }));

  const seen = new Set(existing.map((entry) => entry.id));
  const failures = entries.flatMap((entry) => validateEntry(entry, pricing.rates, seen));
  if (failures.length) throw new Error(`Runtime AI usage failed validation:\n- ${failures.join("\n- ")}`);

  if (options.check) {
    if (entries.length) throw new Error(`${entries.length} runtime AI event(s) are not exported to usage/ledger.jsonl; run pnpm usage:runtime.`);
    if (!options.quiet) console.log(`Runtime AI usage current: ${payload.events.length} D1 event(s), all exported to the ledger.`);
    return [];
  }
  if (!options.dryRun) {
    await mkdir(resolve(root, "usage/private"), { recursive: true });
    await writeFile(runtimeEvidencePath, `${JSON.stringify(payload, null, 2)}\n`);
    if (entries.length) {
      await appendFile(ledgerPath, `${entries.map((entry) => JSON.stringify(entry)).join("\n")}\n`);
      await renderReport();
    }
  }
  if (!options.quiet) {
    const action = options.dryRun ? "would capture" : "captured";
    console.log(`Runtime AI usage ${action} ${entries.length} new event(s) from ${payload.events.length} persisted D1 event(s).`);
    if (options.dryRun && entries.length) console.log(JSON.stringify(entries, null, 2));
  }
  return entries;
}

async function snapshot(options) {
  if (!options.format || !options.file || !options.actor || !options.surface || !options.description || !options.category) throw new Error("snapshot requires --format, --file, --actor, --surface, --description, and --category");
  const filePath = expandLocalPath(options.file);
  const evidence = await readJsonlEvidence(filePath, basename(options.file), options);
  const records = evidence.records;
  const parsers = { claude: parseClaude, codex: parseCodex, openclaw: parseOpenClaw };
  const parser = parsers[options.format];
  if (!parser) throw new Error("--format must be claude, codex, or openclaw");
  const sessionId = options.sessionId
    ?? records.find((record) => record.type === "session_meta")?.payload?.id
    ?? records.find((record) => record.sessionId)?.sessionId
    ?? basename(filePath).match(/[0-9a-f]{8}-[0-9a-f-]{27,}/)?.[0];
  if (!sessionId) throw new Error("Could not derive source session id; pass --session-id");
  const existing = await readLedger();
  const pricing = await readPricing();
  const parsed = parser(records, options);
  const now = new Date().toISOString();
  const sha256 = evidence.sha256;
  const lineCount = evidence.lineCount;
  const commits = options.commits ? options.commits.split(",").filter(Boolean) : [];
  const artifacts = options.artifacts ? options.artifacts.split(",").filter(Boolean) : [];
  const entries = [];
  for (const item of parsed) {
    const prior = existing.filter((entry) => entry.source.sessionId === sessionId && entry.model === item.model).at(-1);
    const tokens = subtractTokens(item.tokens, prior?.source?.cumulative);
    const priorCalls = prior?.source?.cumulative?.calls ?? 0;
    const calls = item.calls === null ? null : item.calls - priorCalls;
    if (Object.values(tokens).every((value) => value === 0) && (calls === null || calls === 0)) continue;
    const rateId = selectRateId(pricing, item.provider, item.model, item.end);
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
  if (!options.dryRun && entries.length) {
    await appendFile(ledgerPath, `${entries.map((entry) => JSON.stringify(entry)).join("\n")}\n`);
    if (!options.skipReport) await renderReport();
  }
  if (!options.quiet) console.log(JSON.stringify(entries, null, 2));
  return entries;
}

async function sync(options = {}) {
  const configPath = options.config ? expandLocalPath(options.config) : sourcesPath;
  let config;
  try {
    config = JSON.parse(await readFile(configPath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") {
      if (!options.quiet) console.log(`AI usage sync not configured. Copy usage/sources.example.json to usage/private/sources.json and add local session paths.`);
      return [];
    }
    throw error;
  }
  if (config.schemaVersion !== 1 || !Array.isArray(config.sources)) throw new Error(`${configPath} must contain schemaVersion 1 and a sources array.`);

  const staged = stagedArtifacts();
  const captured = [];
  for (const source of config.sources) {
    if (source.enabled === false) continue;
    const artifacts = [...new Set([...(source.artifacts ?? []), ...(source.includeStagedArtifacts === false ? [] : staged)])];
    try {
      const file = await resolveSourceFile(source);
      const entries = await snapshot({
        ...source,
        file,
        artifacts: artifacts.join(","),
        commits: (source.commits ?? []).join(","),
        dryRun: options.dryRun,
        quiet: true,
        skipReport: true,
      });
      captured.push(...entries);
    } catch (error) {
      if (source.required === false && error.code === "ENOENT") continue;
      throw new Error(`Usage source ${source.name ?? source.file}: ${error.message}`);
    }
  }
  if (!options.dryRun && captured.length) await renderReport();
  if (!options.quiet) {
    const action = options.dryRun ? "would capture" : "captured";
    console.log(`AI usage sync ${action} ${captured.length} incremental entr${captured.length === 1 ? "y" : "ies"} from ${config.sources.length} configured source(s).`);
  }
  return captured;
}

async function receipt(options = {}) {
  if (!options.file || !options.provider || !options.label || !options.amount || !options.periodStart || !options.periodEnd) {
    throw new Error("receipt requires --file, --provider, --label, --amount, --period-start, and --period-end");
  }
  const amountUsd = Number(options.amount);
  if (!Number.isFinite(amountUsd) || amountUsd <= 0) throw new Error("--amount must be a positive USD value");
  const periodStart = Date.parse(options.periodStart);
  const periodEnd = Date.parse(options.periodEnd);
  if (Number.isNaN(periodStart) || Number.isNaN(periodEnd)) throw new Error("--period-start and --period-end must be ISO-8601 timestamps");
  const period = { start: new Date(periodStart).toISOString(), end: new Date(periodEnd).toISOString() };
  if (period.end < period.start) throw new Error("--period-end must not precede --period-start");

  const [rawReceipt, entries, receipts] = await Promise.all([
    readFile(expandLocalPath(options.file)),
    readLedger(),
    readReceipts(),
  ]);
  const alreadyCovered = new Set(receipts.flatMap((item) => item.coversEntryIds ?? []));
  const explicitIds = options.covers ? options.covers.split(",").map((id) => id.trim()).filter(Boolean) : null;
  const coversEntryIds = explicitIds ?? entries
    .filter((entry) =>
      entry.provider === options.provider &&
      entry.cost.actualBilledUsd === null &&
      entry.period.end >= period.start &&
      entry.period.start <= period.end &&
      !alreadyCovered.has(entry.id),
    )
    .map((entry) => entry.id);
  if (coversEntryIds.length === 0) throw new Error("No uncovered usage entries match this provider and billing period; pass --covers with explicit ledger ids if needed.");

  const now = new Date().toISOString();
  const sha256 = sourceDigest(rawReceipt);
  if (receipts.some((item) => item.source?.sha256 === sha256)) throw new Error("This receipt file is already recorded.");
  const idHash = createHash("sha256")
    .update(`${options.provider}:${period.start}:${period.end}:${amountUsd}:${sha256}`)
    .digest("hex")
    .slice(0, 12);
  const record = {
    schemaVersion: 1,
    id: `receipt-${now.slice(0, 10).replaceAll("-", "")}-${idHash}`,
    recordedAt: now,
    provider: options.provider,
    label: options.label,
    period,
    amountUsd,
    receiptStatus: "evidenced_subscription_receipt",
    source: {
      kind: "provider_receipt",
      sha256,
      bytes: rawReceipt.length,
      rawEvidence: "retained_privately",
    },
    coversEntryIds,
    notes: ["Raw receipt retained privately; only its digest, byte size, allocation, and billed amount are committed."],
  };
  const errors = validateReceipt(record, entries, new Set(receipts.map((item) => item.id)), alreadyCovered);
  if (errors.length) throw new Error(`Receipt failed validation:\n- ${errors.join("\n- ")}`);
  if (!options.dryRun) {
    await appendFile(receiptsPath, `${JSON.stringify(record)}\n`);
    await renderReport();
  }
  if (!options.quiet) console.log(JSON.stringify(record, null, 2));
  return record;
}


function aggregate(entries, receipts = []) {
  const totals = new Map();
  let estimated = 0;
  let actual = receipts.reduce((sum, item) => sum + item.amountUsd, 0);
  let pending = 0;
  const covered = new Set(receipts.flatMap((item) => item.coversEntryIds ?? []));
  for (const entry of entries) {
    const key = `${entry.provider}/${entry.model}`;
    const row = totals.get(key) ?? { calls: 0, entries: 0, tokens: normalizeTokens(), estimated: 0 };
    row.calls += entry.calls ?? 0;
    row.entries += 1;
    row.tokens = addTokens(row.tokens, entry.tokens);
    row.estimated += entry.cost.estimatedUsd;
    totals.set(key, row);
    estimated += entry.cost.estimatedUsd;
    if (entry.cost.actualBilledUsd !== null) actual += entry.cost.actualBilledUsd;
    else if (!covered.has(entry.id)) pending += 1;
  }
  return { totals, estimated, actual, pending };
}

function summaryTable({ totals, estimated }) {
  const lines = [
    "| Provider / model | Entries | Calls | Input | Cache reads | Cache writes | Output | API-equivalent USD |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
  ];
  let entryCount = 0;
  for (const [key, row] of totals) {
    entryCount += row.entries;
    const writes = row.tokens.cacheWrite + row.tokens.cacheWrite5m + row.tokens.cacheWrite1h;
    lines.push(`| ${key} | ${row.entries} | ${row.calls || "—"} | ${row.tokens.uncachedInput.toLocaleString("en-US")} | ${row.tokens.cacheRead.toLocaleString("en-US")} | ${writes.toLocaleString("en-US")} | ${row.tokens.output.toLocaleString("en-US")} | $${row.estimated.toFixed(2)} |`);
  }
  lines.push(`| **Total** | **${entryCount}** | | | | | | **$${estimated.toFixed(2)}** |`);
  return lines.join("\n");
}

function buildReport(entries, digest, generatedAt, receipts = [], receiptDigest = sourceDigest("")) {
  const agg = aggregate(entries, receipts);

  const inventory = entries.map((entry) => {
    const day = entry.period.end.slice(0, 10);
    const refs = [...(entry.commits ?? []), ...(entry.artifacts ?? [])];
    const evidence = `\`${entry.source.sha256.slice(0, 12)}…\` (${entry.source.lineCount} lines)`;
    return `| ${day} | ${entry.actor.name} | ${entry.model} | ${entry.category.replaceAll("_", " ")} | ${entry.tokens.providerTotal.toLocaleString("en-US")} | $${entry.cost.estimatedUsd.toFixed(2)} | ${evidence} | ${refs.length ? refs.map((ref) => `\`${ref.slice(0, 9)}\``).join(" ") : "—"} |`;
  });
  const receiptInventory = receipts.map((receipt) => {
    const evidence = `\`${receipt.source.sha256.slice(0, 12)}…\` (${receipt.source.bytes.toLocaleString("en-US")} bytes)`;
    return `| ${receipt.period.start.slice(0, 10)}–${receipt.period.end.slice(0, 10)} | ${receipt.provider} | ${receipt.label} | $${receipt.amountUsd.toFixed(2)} | ${receipt.coversEntryIds.length} | ${evidence} |`;
  });

  const md = `# AI usage reimbursement audit

Generated ${generatedAt} UTC by \`pnpm usage:report\`. Do not edit by hand — regenerate instead.

Ledger digest: \`${digest}\` (${entries.length} entries). \`pnpm usage:check\` fails if this file no longer matches the ledger.
Receipt-allocation digest: \`${receiptDigest}\` (${receipts.length} records). Raw receipts remain private.

## The three numbers, kept separate

1. **Provider-reported tokens** — counters copied from local provider session logs.
2. **API-equivalent estimate — $${agg.estimated.toFixed(2)}** — those tokens at pinned public list prices ([pricing.json](pricing.json)). A workload gauge, not a bill.
3. **Actual billed spend — $${agg.actual.toFixed(2)} evidenced so far** — the number a reimbursement claim uses. ${agg.pending} usage entr${agg.pending === 1 ? "y" : "ies"} remain uncovered by a recorded receipt.

The [brief](https://docs.google.com/document/d/1rBHJtiNKHv4i43tdf2Rm0sDEYuIcajhmAPoBKR_Az-A/) allows a valid submission up to **$500** in token-cost reimbursement, including qualifying Codex Pro / Claude Max subscription usage, subject to proof and organizer review. The claim will be the receipt amounts, capped at $500 — never the API-equivalent gauge.

## Workload by model

${summaryTable(agg)}

## Evidence inventory

One row per immutable ledger entry. The digest is the SHA-256 of the raw provider session log, which is retained privately and available to the organizer on request.

| Period end | Session | Model | Category | Provider tokens | API-equiv | Raw evidence | Commits/artifacts |
| --- | --- | --- | --- | ---: | ---: | --- | --- |
${inventory.join("\n")}

## Receipt allocations

Receipt files stay in \`usage/private/\`. The tracked allocation ledger stores only a SHA-256, byte size, billing period, amount, and the usage-entry ids covered, preventing the same work or receipt from being claimed twice.

| Billing period | Provider | Receipt label | Actual USD | Usage entries covered | Private receipt evidence |
| --- | --- | --- | ---: | ---: | --- |
${receiptInventory.length ? receiptInventory.join("\n") : "| — | — | No receipt recorded yet | $0.00 | 0 | — |"}

## How to audit this

1. \`pnpm usage:check\` — validates every entry against the schema, recomputes each cost from [pricing.json](pricing.json), rejects duplicate evidence, and confirms this report matches the ledger digest above.
2. \`git log --follow usage/ledger.jsonl\` — the ledger is append-only; history shows every addition in context.
3. Compare any entry's \`sha256\` against the raw session log we provide on request; the line count must match.
4. \`pnpm usage:receipt -- ...\` hashes a private receipt and appends an immutable allocation record; validation rejects duplicate receipt files and overlapping usage-entry coverage.
`;

  return { md, estimated: agg.estimated };
}

async function renderReport() {
  const [rawLedger, rawReceipts] = await Promise.all([
    readFile(ledgerPath, "utf8"),
    readFile(receiptsPath, "utf8").catch((error) => error.code === "ENOENT" ? "" : Promise.reject(error)),
  ]);
  const entries = parseJsonl(rawLedger, "usage/ledger.jsonl");
  const receipts = parseJsonl(rawReceipts, "usage/receipts.jsonl");
  const digest = sourceDigest(rawLedger);
  const receiptDigest = sourceDigest(rawReceipts);
  const generatedAt = new Date().toISOString().slice(0, 16).replace("T", " ");
  const built = buildReport(entries, digest, generatedAt, receipts, receiptDigest);
  await writeFile(reportPath, built.md);
  return { digest, entries: entries.length, estimated: built.estimated };
}

async function report() {
  const result = await renderReport();
  console.log(`usage/REPORT.md regenerated: ${result.entries} entries, $${result.estimated.toFixed(2)} API-equivalent, digest ${result.digest.slice(0, 12)}…`);
}

async function check() {
  const [entries, pricing, receipts] = await Promise.all([readLedger(), readPricing(), readReceipts()]);
  const seen = new Set();
  const failures = entries.flatMap((entry, index) => validateEntry(entry, pricing.rates, seen).map((message) => `line ${index + 1}: ${message}`));
  const seenReceipts = new Set();
  const covered = new Set();
  failures.push(...receipts.flatMap((receipt, index) => validateReceipt(receipt, entries, seenReceipts, covered).map((message) => `receipt line ${index + 1}: ${message}`)));
  if (failures.length) throw new Error(`Usage ledger failed validation:\n- ${failures.join("\n- ")}`);
  const [rawLedger, rawReceipts] = await Promise.all([
    readFile(ledgerPath, "utf8"),
    readFile(receiptsPath, "utf8").catch((error) => error.code === "ENOENT" ? "" : Promise.reject(error)),
  ]);
  const digest = sourceDigest(rawLedger);
  const receiptDigest = sourceDigest(rawReceipts);
  const reportText = await readFile(reportPath, "utf8").catch(() => "");
  const stamp = reportText.match(/^Generated (.+) UTC by/m)?.[1];
  const expected = stamp ? buildReport(entries, digest, stamp, receipts, receiptDigest).md : null;
  if (expected === null || reportText !== expected) {
    throw new Error("usage/REPORT.md is stale or hand-edited: run `pnpm usage:report` to regenerate it from the ledger.");
  }
  console.log(`Usage ledger valid: ${entries.length} entries, ${seen.size} unique evidence records, ${receipts.length} receipt allocation(s). Report is current.`);
}

async function summary() {
  const [entries, receipts] = await Promise.all([readLedger(), readReceipts()]);
  const { totals, estimated, actual, pending } = aggregate(entries, receipts);
  console.log("# AI usage reimbursement summary\n");
  console.log("| Provider / model | Entries | Calls | Input | Cache reads | Cache writes | Output | API-equivalent USD |");
  console.log("| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |");
  for (const [key, row] of totals) {
    const writes = row.tokens.cacheWrite + row.tokens.cacheWrite5m + row.tokens.cacheWrite1h;
    console.log(`| ${key} | ${row.entries} | ${row.calls || "—"} | ${row.tokens.uncachedInput.toLocaleString()} | ${row.tokens.cacheRead.toLocaleString()} | ${writes.toLocaleString()} | ${row.tokens.output.toLocaleString()} | $${row.estimated.toFixed(2)} |`);
  }
  console.log(`\nAPI-equivalent estimate: **$${estimated.toFixed(2)}**.`);
  console.log(`Actual billed spend evidenced so far: **$${actual.toFixed(2)}** across ${receipts.length} receipt allocation(s). Receipt/subscription proof pending on ${pending} entries.`);
  console.log("\nThe estimate is a workload gauge, not a reimbursement claim. Use invoices or subscription receipts for the actual claim.");
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  if (command === "check") return check();
  if (command === "summary") return summary();
  if (command === "snapshot") return snapshot(cliArgs(rest));
  if (command === "sync") return sync(cliArgs(rest));
  if (command === "runtime") return runtime(cliArgs(rest));
  if (command === "receipt") return receipt(cliArgs(rest));
  if (command === "report") return report();
  throw new Error("Usage: usage-ledger.mjs <check|summary|snapshot|sync|runtime|receipt|report>");
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
