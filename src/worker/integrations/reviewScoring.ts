import type { ProviderEvidence } from "./decisionFeedback";

export interface ReviewScoringInput {
  title: string;
  abstract: string;
  criteria: Array<{ key: string; label: string; maxScore: number; weight: number }>;
}

export interface ReviewScoreDraft {
  scores: Record<string, number>;
  recommendation: "accept" | "waitlist" | "reject";
  comment: string;
  aiUsed: boolean;
  model?: string;
  note: string;
  providerEvidence?: ProviderEvidence;
}

export interface ReviewScoringConfig {
  apiKey?: string;
  model?: string;
  fetcher?: typeof fetch;
}

export function deterministicReviewScoreDraft(input: ReviewScoringInput): ReviewScoreDraft {
  const scores = Object.fromEntries(input.criteria.map((criterion) => [
    criterion.key,
    Math.max(1, Math.min(criterion.maxScore, Math.round(criterion.maxScore * 0.7))),
  ]));
  return {
    scores,
    recommendation: "waitlist",
    comment: "Automated fallback draft only. Review the abstract against each criterion and replace these starting scores before saving.",
    aiUsed: false,
    note: "Deterministic fallback — no API charge. Human review and explicit save are still required.",
  };
}

const SCORE_TOOL = {
  name: "review_score_draft",
  description: "Draft editable numeric scores and a short review rationale for a human reviewer.",
  input_schema: {
    type: "object",
    properties: {
      scores: { type: "object", additionalProperties: { type: "number" } },
      recommendation: { type: "string", enum: ["accept", "waitlist", "reject"] },
      comment: { type: "string" },
    },
    required: ["scores", "recommendation", "comment"],
  },
};

function counter(value: unknown, name: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0) throw new Error(`Anthropic response is missing ${name}.`);
  return Number(value);
}

export async function draftReviewScores(input: ReviewScoringInput, config: ReviewScoringConfig): Promise<ReviewScoreDraft> {
  if (!config.apiKey) return deterministicReviewScoreDraft(input);
  const fallback = deterministicReviewScoreDraft(input);
  const model = config.model ?? "claude-haiku-4-5-20251001";
  const doFetch = config.fetcher ?? fetch;
  try {
    const response = await doFetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": config.apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model,
        max_tokens: 350,
        tools: [SCORE_TOOL],
        tool_choice: { type: "tool", name: "review_score_draft" },
        messages: [{ role: "user", content: [
          "Draft a conservative conference proposal scorecard. Scores are suggestions only; the human will review and explicitly save them.",
          `Title: ${input.title}`,
          `Abstract: ${input.abstract.slice(0, 4_000)}`,
          `Criteria: ${JSON.stringify(input.criteria)}`,
        ].join("\n\n") }],
      }),
    });
    if (!response.ok) throw new Error(`Anthropic request failed (${response.status}).`);
    const body = await response.json() as {
      id?: unknown; model?: unknown; usage?: Record<string, unknown> & { cache_creation?: Record<string, unknown> };
      content?: Array<{ type?: unknown; input?: { scores?: unknown; recommendation?: unknown; comment?: unknown } }>;
    };
    if (typeof body.id !== "string" || !body.usage) throw new Error("Anthropic response omitted usage evidence.");
    const tool = body.content?.find((block) => block.type === "tool_use")?.input;
    if (!tool || typeof tool.scores !== "object" || tool.scores === null || typeof tool.comment !== "string"
      || !["accept", "waitlist", "reject"].includes(String(tool.recommendation))) throw new Error("Anthropic score draft was malformed.");
    const rawScores = tool.scores as Record<string, unknown>;
    const scores = Object.fromEntries(input.criteria.map((criterion) => {
      const value = Number(rawScores[criterion.key]);
      return [criterion.key, Number.isFinite(value) ? Math.max(1, Math.min(criterion.maxScore, Math.round(value))) : fallback.scores[criterion.key]!];
    }));
    const responseModel = typeof body.model === "string" ? body.model : model;
    const providerEvidence: ProviderEvidence = {
      requestId: body.id,
      model: responseModel,
      usage: {
        inputTokens: counter(body.usage.input_tokens, "usage.input_tokens"),
        cacheCreationInputTokens: counter(body.usage.cache_creation_input_tokens ?? 0, "usage.cache_creation_input_tokens"),
        cacheCreation5mInputTokens: counter(body.usage.cache_creation?.ephemeral_5m_input_tokens ?? 0, "usage.cache_creation.ephemeral_5m_input_tokens"),
        cacheCreation1hInputTokens: counter(body.usage.cache_creation?.ephemeral_1h_input_tokens ?? 0, "usage.cache_creation.ephemeral_1h_input_tokens"),
        cacheReadInputTokens: counter(body.usage.cache_read_input_tokens ?? 0, "usage.cache_read_input_tokens"),
        outputTokens: counter(body.usage.output_tokens, "usage.output_tokens"),
      },
    };
    return {
      scores,
      recommendation: tool.recommendation as ReviewScoreDraft["recommendation"],
      comment: tool.comment.trim().slice(0, 5_000),
      aiUsed: true,
      model: responseModel,
      note: "AI-assisted draft only. Every score remains editable and nothing is saved until the reviewer submits.",
      providerEvidence,
    };
  } catch {
    return { ...fallback, note: "AI scoring was unavailable, so Lectern used a no-cost fallback draft. Review every value before saving." };
  }
}
