import { describe, expect, it } from "vitest";
import { aggregateWeightedScores, weightedScore } from "./reviews";

describe("weighted review scoring", () => {
  const criteria = [{ key: "originality", weight: 2 }, { key: "relevance", weight: 1 }];

  it("uses criterion weights", () => {
    expect(weightedScore({ originality: 4, relevance: 2 }, criteria)).toBeCloseTo(3.3333, 3);
  });

  it("averages completed reviewer scorecards", () => {
    expect(aggregateWeightedScores([
      { scores: { originality: 4, relevance: 2 } },
      { scores: { originality: 5, relevance: 5 } },
    ], criteria)).toBeCloseTo(4.1666, 3);
  });

  it("returns null without numeric evidence", () => {
    expect(weightedScore({}, criteria)).toBeNull();
  });
});
