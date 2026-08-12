import { describe, expect, it } from "vitest";
import { deterministicReviewScoreDraft, draftReviewScores } from "./reviewScoring";

const input = {
  title: "Safer builds",
  abstract: "A detailed proposal about reproducible builds and practical verification patterns.",
  criteria: [{ key: "originality", label: "Originality", maxScore: 5, weight: 1 }],
};

describe("review scoring assist", () => {
  it("provides a bounded no-cost fallback that never saves anything", () => {
    expect(deterministicReviewScoreDraft(input)).toMatchObject({ scores: { originality: 4 }, recommendation: "waitlist", aiUsed: false });
  });

  it("captures provider usage and clamps AI scores to the configured criterion", async () => {
    const fetcher: typeof fetch = async () => new Response(JSON.stringify({
      id: "msg_score_1", model: "claude-haiku-4-5-20251001",
      usage: { input_tokens: 100, output_tokens: 20 },
      content: [{ type: "tool_use", input: { scores: { originality: 99 }, recommendation: "accept", comment: "Strong and specific." } }],
    }), { status: 200 });
    const result = await draftReviewScores(input, { apiKey: "test", fetcher });
    expect(result).toMatchObject({ scores: { originality: 5 }, recommendation: "accept", aiUsed: true, model: "claude-haiku-4-5-20251001" });
    expect(result.providerEvidence?.usage).toMatchObject({ inputTokens: 100, outputTokens: 20 });
  });
});
