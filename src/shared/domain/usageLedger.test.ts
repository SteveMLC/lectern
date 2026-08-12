// @ts-nocheck -- exercises the repository's JavaScript CLI module directly.
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { estimateCost, parseAnthropicUsageExport, parseClaude, parseCodex, parseCsv, parseOpenClaw, readJsonlEvidence, requirePrivateEvidenceFile, runtimeEventToEntry, runtimePayloadFromD1Results, selectRateId, unexpectedTrackedPrivatePaths, validateEntry, validateReceipt } from "../../../scripts/usage-ledger.mjs";

describe("usage ledger", () => {
  it("prices cached and uncached tokens separately", () => {
    expect(estimateCost(
      { uncachedInput: 1_000_000, cacheRead: 1_000_000, cacheWrite1h: 1_000_000, output: 1_000_000 },
      { uncachedInput: 10, cacheRead: 1, cacheWrite1h: 20, output: 50 },
    )).toBe(81);
  });

  it("selects the latest applicable rate from configuration", () => {
    const pricing = {
      rates: {
        old: { provider: "openai", model: "gpt-dynamic", effectiveAt: "2026-01-01" },
        future: { provider: "openai", model: "gpt-dynamic", effectiveAt: "2027-01-01" },
        current: { provider: "openai", model: "gpt-dynamic", effectiveAt: "2026-08-01" },
        other: { provider: "anthropic", model: "gpt-dynamic", effectiveAt: "2026-08-01" },
      },
    };
    expect(selectRateId(pricing, "openai", "gpt-dynamic", "2026-08-10T00:00:00Z")).toBe("current");
  });

  it("requires a pricing record instead of a hardcoded model change", () => {
    expect(() => selectRateId({ rates: {} }, "openai", "new-model", "2026-08-10T00:00:00Z"))
      .toThrow("add a dated entry to usage/pricing.json");
  });

  it("parses quoted provider CSV fields without leaking metadata into usage aggregates", () => {
    expect(parseCsv('day,workspace,tokens\n2026-08-12,"Team, Primary",42\n')).toEqual([
      { day: "2026-08-12", workspace: "Team, Primary", tokens: "42" },
    ]);
  });

  it("aggregates Anthropic provider exports by day and model", () => {
    const header = "usage_date_utc,model_version,usage_input_tokens_no_cache,usage_input_tokens_cache_write_5m,usage_input_tokens_cache_write_1h,usage_input_tokens_cache_read,usage_output_tokens";
    const results = parseAnthropicUsageExport(`${header}\n2026-08-12,claude-sonnet-5,10,20,30,40,50\n2026-08-12,claude-sonnet-5,1,2,3,4,5\n`);
    expect(results).toEqual([{
      day: "2026-08-12",
      model: "claude-sonnet-5",
      tokens: {
        uncachedInput: 11,
        cacheRead: 44,
        cacheWrite: 0,
        cacheWrite5m: 22,
        cacheWrite1h: 33,
        output: 55,
        reasoningOutput: 0,
        providerTotal: 165,
      },
    }]);
  });

  it("deduplicates repeated Claude message records", () => {
    const record = {
      type: "assistant",
      timestamp: "2026-08-10T00:00:00Z",
      message: {
        id: "message-1",
        model: "claude-fable-5",
        usage: {
          input_tokens: 2,
          cache_read_input_tokens: 10,
          cache_creation_input_tokens: 20,
          cache_creation: { ephemeral_5m_input_tokens: 0, ephemeral_1h_input_tokens: 20 },
          output_tokens: 3,
        },
      },
    };
    const [result] = parseClaude([record, record]);
    expect(result.calls).toBe(1);
    expect(result.tokens.providerTotal).toBe(35);
  });

  it("streams and hashes large bounded evidence without retaining irrelevant records", async () => {
    const directory = await mkdtemp(join(tmpdir(), "speakerops-usage-"));
    const file = join(directory, "claude.jsonl");
    const old = JSON.stringify({ type: "assistant", timestamp: "2026-08-01T00:00:00Z", message: { id: "old", model: "claude-opus-5", usage: { input_tokens: 1 } } });
    const irrelevant = JSON.stringify({ type: "attachment", timestamp: "2026-08-01T00:00:01Z", payload: "x".repeat(1_000_000) });
    const current = JSON.stringify({ type: "assistant", timestamp: "2026-08-10T00:00:00Z", message: { id: "current", model: "claude-opus-5", usage: { input_tokens: 2 } } });
    const raw = `${old}\n${irrelevant}\n${current}\n`;
    try {
      await writeFile(file, raw);
      const evidence = await readJsonlEvidence(file, "fixture", {
        format: "claude",
        sessionId: "fixture-session",
        since: "2026-08-09T00:00:00Z",
      });
      expect(evidence.lineCount).toBe(3);
      expect(evidence.sha256).toBe(createHash("sha256").update(raw).digest("hex"));
      expect(evidence.records).toHaveLength(1);
      expect(evidence.records[0].message.id).toBe("current");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("normalizes cumulative Codex input counters", () => {
    const records = [
      { type: "session_meta", timestamp: "2026-08-10T00:00:00Z" },
      { type: "turn_context", timestamp: "2026-08-10T00:00:01Z", payload: { model: "gpt-5.6-sol" } },
      { type: "event_msg", timestamp: "2026-08-10T00:00:02Z", payload: { type: "token_count", info: { total_token_usage: { input_tokens: 100, cached_input_tokens: 80, cache_write_input_tokens: 5, output_tokens: 10, reasoning_output_tokens: 3, total_tokens: 110 } } } },
    ];
    const [result] = parseCodex(records);
    expect(result.tokens.uncachedInput).toBe(15);
    expect(result.tokens.reasoningOutput).toBe(3);
  });

  it("ignores zero-usage OpenClaw delivery mirrors", () => {
    const [result] = parseOpenClaw([
      { type: "message", timestamp: "2026-08-10T00:00:00Z", message: { role: "assistant", model: "delivery-mirror", usage: { totalTokens: 0 } } },
      { type: "message", timestamp: "2026-08-10T00:00:01Z", message: { role: "assistant", model: "gpt-5.5", usage: { input: 4, cacheRead: 6, output: 2, totalTokens: 12 } } },
    ]);
    expect(result.model).toBe("gpt-5.5");
    expect(result.calls).toBe(1);
  });

  it("converts persisted runtime counters without storing request content", () => {
    const pricing = {
      rates: {
        sonnet: {
          provider: "anthropic",
          model: "claude-sonnet-5",
          effectiveAt: "2026-06-30",
          uncachedInput: 2,
          cacheRead: 0.2,
          cacheWrite: 2.5,
          cacheWrite5m: 2.5,
          cacheWrite1h: 4,
          output: 10,
        },
      },
    };
    const entry = runtimeEventToEntry({
      provider: "anthropic",
      provider_request_id: "msg_runtime_1",
      model: "claude-sonnet-5",
      purpose: "decision_feedback_draft",
      occurred_at: "2026-08-10T17:00:00.000Z",
      input_tokens: 100,
      cache_creation_input_tokens: 30,
      cache_creation_5m_input_tokens: 10,
      cache_creation_1h_input_tokens: 15,
      cache_read_input_tokens: 40,
      output_tokens: 20,
      evidence_sha256: "e".repeat(64),
      measurement: "provider_reported",
    }, pricing, {
      surface: "https://speakerops.example",
      commit: "abc123",
      recordedAt: "2026-08-10T17:01:00.000Z",
    });
    expect(entry.tokens).toEqual({
      uncachedInput: 100,
      cacheRead: 40,
      cacheWrite: 5,
      cacheWrite5m: 10,
      cacheWrite1h: 15,
      output: 20,
      reasoningOutput: 0,
      providerTotal: 190,
    });
    expect(entry.source).toMatchObject({ kind: "speakerops_runtime_d1", sessionId: "msg_runtime_1" });
    expect(entry.cost).toMatchObject({ rateId: "sonnet", receiptStatus: "pending_provider_invoice" });
    expect(entry).not.toHaveProperty("prompt");
    expect(entry).not.toHaveProperty("reviewerNotes");
    expect(entry).not.toHaveProperty("generatedContent");
  });

  it("normalizes authenticated Wrangler D1 results into the runtime export schema", () => {
    const event = {
      provider: "anthropic",
      provider_request_id: "msg_runtime_2",
      model: "claude-sonnet-5",
      purpose: "schedule_notice_draft",
      occurred_at: "2026-08-11T12:00:00.000Z",
      input_tokens: 10,
      cache_creation_input_tokens: 0,
      cache_creation_5m_input_tokens: 0,
      cache_creation_1h_input_tokens: 0,
      cache_read_input_tokens: 0,
      output_tokens: 5,
      evidence_sha256: "f".repeat(64),
      measurement: "provider_reported",
    };
    const payload = runtimePayloadFromD1Results(
      [{ success: true, results: [event] }],
      "2026-08-11T12:01:00.000Z",
    );
    expect(payload).toEqual({
      schemaVersion: 1,
      generatedAt: "2026-08-11T12:01:00.000Z",
      privacy: "Provider counters only; prompts, reviewer notes, and generated content are not stored.",
      events: [event],
    });
  });

  it("rejects unsuccessful Wrangler D1 result batches", () => {
    expect(() => runtimePayloadFromD1Results([{ success: false, results: [] }]))
      .toThrow("successful result batches");
  });

  it("rejects duplicate evidence ids", () => {
    const entry = {
      schemaVersion: 1,
      id: "same",
      recordedAt: "2026-08-10T00:00:00Z",
      period: { start: "2026-08-10T00:00:00Z", end: "2026-08-10T00:00:01Z" },
      actor: { name: "Agent", surface: "Tool" },
      provider: "openai",
      model: "gpt-5.5",
      category: "test",
      description: "test",
      measurement: "provider_reported",
      calls: null,
      tokens: { uncachedInput: 0, cacheRead: 0, cacheWrite: 0, cacheWrite5m: 0, cacheWrite1h: 0, output: 0, reasoningOutput: 0, providerTotal: 0 },
      cost: { kind: "api_list_price_estimate", rateId: "rate", estimatedUsd: 0, actualBilledUsd: null, receiptStatus: "pending_subscription_receipt" },
      source: {
        kind: "test",
        sessionId: "session",
        sha256: "a".repeat(64),
        lineCount: 1,
        rawEvidence: "retained_privately",
        cumulative: { uncachedInput: 0, cacheRead: 0, cacheWrite: 0, cacheWrite5m: 0, cacheWrite1h: 0, output: 0, reasoningOutput: 0, providerTotal: 0 },
      },
      commits: [],
      artifacts: [],
      notes: [],
    };
    const rates = { rate: { provider: "openai", model: "gpt-5.5" } };
    const seen = new Set();
    expect(validateEntry(entry, rates, seen)).toEqual([]);
    expect(validateEntry(entry, rates, seen)).toContain("duplicate id same");
  });

  it("rejects inconsistent totals, reversed periods, and leaked absolute paths", () => {
    const entry = {
      schemaVersion: 1,
      id: "tampered",
      recordedAt: "2026-08-10T00:00:00Z",
      period: { start: "2026-08-10T00:00:02Z", end: "2026-08-10T00:00:01Z" },
      actor: { name: "Agent", surface: "Tool" },
      provider: "openai",
      model: "gpt-5.5",
      category: "test",
      description: "test",
      measurement: "provider_reported",
      calls: 1,
      tokens: { uncachedInput: 3, cacheRead: 2, cacheWrite: 0, cacheWrite5m: 0, cacheWrite1h: 0, output: 1, reasoningOutput: 1, providerTotal: 99 },
      cost: { kind: "api_list_price_estimate", rateId: "rate", estimatedUsd: 0, actualBilledUsd: null, receiptStatus: "pending_subscription_receipt" },
      source: {
        kind: "test",
        sessionId: "session",
        sha256: "a".repeat(64),
        lineCount: 1,
        rawEvidence: "retained_privately",
        cumulative: { uncachedInput: 3, cacheRead: 2, cacheWrite: 0, cacheWrite5m: 0, cacheWrite1h: 0, output: 1, reasoningOutput: 1, providerTotal: 6 },
      },
      commits: [],
      artifacts: ["/Users/example/private/session.jsonl"],
      notes: [],
    };
    const errors = validateEntry(entry, { rate: { provider: "openai", model: "gpt-5.5" } });
    expect(errors).toContain("period end must not precede period start");
    expect(errors).toContain("tokens.providerTotal 99 does not match normalized categories 6");
    expect(errors).toContain("artifacts must not contain absolute local paths");
  });

  it("allows only the tracked instruction file under private evidence", () => {
    expect(unexpectedTrackedPrivatePaths([
      "usage/private/README.md",
      "usage/private/provider-receipt.pdf",
      "usage/private/session.jsonl",
      "usage/REPORT.md",
    ])).toEqual([
      "usage/private/provider-receipt.pdf",
      "usage/private/session.jsonl",
    ]);
  });

  it("validates an immutable private-receipt allocation", () => {
    const entry = {
      id: "usage-1",
      provider: "openai",
      cost: { actualBilledUsd: null },
    };
    const receipt = {
      schemaVersion: 1,
      id: "receipt-1",
      recordedAt: "2026-08-10T12:00:00Z",
      provider: "openai",
      label: "Codex subscription — August 2026",
      period: { start: "2026-08-01T00:00:00Z", end: "2026-08-31T23:59:59Z" },
      amountUsd: 200,
      receiptStatus: "evidenced_subscription_receipt",
      source: { kind: "provider_receipt", sha256: "b".repeat(64), bytes: 1234, rawEvidence: "retained_privately" },
      coversEntryIds: ["usage-1"],
    };
    expect(validateReceipt(receipt, [entry])).toEqual([]);
  });

  it("validates provider usage statements with hashed supporting purchase receipts", () => {
    const entry = { id: "usage-api-1", provider: "anthropic", cost: { actualBilledUsd: null } };
    const statement = {
      schemaVersion: 1,
      id: "receipt-api-1",
      recordedAt: "2026-08-12T12:00:00Z",
      provider: "anthropic",
      label: "Anthropic API usage — August 2026",
      period: { start: "2026-08-10T00:00:00Z", end: "2026-08-12T23:59:59Z" },
      amountUsd: 40.13,
      receiptStatus: "evidenced_provider_usage_statement",
      source: { kind: "provider_usage_statement", sha256: "e".repeat(64), bytes: 200, rawEvidence: "retained_privately" },
      supportingSources: [
        { kind: "provider_receipt", sha256: "f".repeat(64), bytes: 100, rawEvidence: "retained_privately" },
      ],
      coversEntryIds: ["usage-api-1"],
    };
    expect(validateReceipt(statement, [entry])).toEqual([]);
  });

  it("validates zero-dollar append-only coverage extensions", () => {
    const entry = { id: "usage-new", provider: "openai", cost: { actualBilledUsd: null } };
    const extension = {
      schemaVersion: 1,
      id: "allocation-1",
      recordedAt: "2026-08-12T12:00:00Z",
      provider: "openai",
      label: "ChatGPT Pro — coverage extension",
      period: { start: "2026-07-21T00:00:00Z", end: "2026-08-21T23:59:59Z" },
      amountUsd: 0,
      receiptStatus: "evidenced_allocation_extension",
      extendsReceiptId: "receipt-primary",
      source: { kind: "existing_evidence_reference", sha256: "a".repeat(64), bytes: 123, rawEvidence: "retained_privately" },
      coversEntryIds: ["usage-new"],
    };
    expect(validateReceipt(extension, [entry])).toEqual([]);
  });

  it("refuses to ingest an unrelated receipt outside the private evidence directory", async () => {
    const directory = await mkdtemp(join(tmpdir(), "speakerops-receipt-boundary-"));
    const privateDirectory = join(directory, "usage", "private");
    const outsideReceipt = join(directory, "unrelated-invoice.pdf");
    const privateReceipt = join(privateDirectory, "provider-receipt.pdf");
    try {
      await mkdir(privateDirectory, { recursive: true });
      await Promise.all([
        writeFile(outsideReceipt, "not provider evidence"),
        writeFile(privateReceipt, "provider evidence"),
      ]);
      await expect(requirePrivateEvidenceFile(outsideReceipt, privateDirectory))
        .rejects.toThrow("explicitly placed inside usage/private/");
      await expect(requirePrivateEvidenceFile(privateReceipt, privateDirectory))
        .resolves.toBe(await realpath(privateReceipt));
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("refuses a private-directory symlink that resolves to an outside receipt", async () => {
    const directory = await mkdtemp(join(tmpdir(), "speakerops-receipt-symlink-"));
    const privateDirectory = join(directory, "usage", "private");
    const outsideReceipt = join(directory, "outside.pdf");
    const linkedReceipt = join(privateDirectory, "linked.pdf");
    try {
      await mkdir(privateDirectory, { recursive: true });
      await writeFile(outsideReceipt, "outside evidence");
      await symlink(outsideReceipt, linkedReceipt);
      await expect(requirePrivateEvidenceFile(linkedReceipt, privateDirectory))
        .rejects.toThrow("explicitly placed inside usage/private/");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("rejects double-covered usage across receipt records", () => {
    const entries = [{ id: "usage-1", provider: "openai", cost: { actualBilledUsd: null } }];
    const base = {
      schemaVersion: 1,
      recordedAt: "2026-08-10T12:00:00Z",
      provider: "openai",
      label: "Subscription receipt",
      period: { start: "2026-08-01T00:00:00Z", end: "2026-08-31T23:59:59Z" },
      amountUsd: 100,
      receiptStatus: "evidenced_subscription_receipt",
      source: { kind: "provider_receipt", sha256: "c".repeat(64), bytes: 100, rawEvidence: "retained_privately" },
      coversEntryIds: ["usage-1"],
    };
    const covered = new Set();
    expect(validateReceipt({ ...base, id: "receipt-1" }, entries, new Set(), covered)).toEqual([]);
    expect(validateReceipt({ ...base, id: "receipt-2", source: { ...base.source, sha256: "d".repeat(64) } }, entries, new Set(), covered))
      .toContain("usage entry usage-1 is covered by more than one receipt");
  });
});
