// @ts-nocheck -- exercises the repository's JavaScript CLI module directly.
import { describe, expect, it } from "vitest";
import { estimateCost, parseClaude, parseCodex, parseOpenClaw, selectRateId, validateEntry } from "../../../scripts/usage-ledger.mjs";

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
      tokens: { uncachedInput: 0, cacheRead: 0, cacheWrite: 0, cacheWrite5m: 0, cacheWrite1h: 0, output: 0, reasoningOutput: 0, providerTotal: 0 },
      cost: { rateId: "rate", estimatedUsd: 0, actualBilledUsd: null },
      source: { kind: "test", sessionId: "session", sha256: "a".repeat(64), lineCount: 1, rawEvidence: "retained_privately" },
    };
    const rates = { rate: { provider: "openai", model: "gpt-5.5" } };
    const seen = new Set();
    expect(validateEntry(entry, rates, seen)).toEqual([]);
    expect(validateEntry(entry, rates, seen)).toContain("duplicate id same");
  });
});
