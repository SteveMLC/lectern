import { describe, expect, it } from "vitest";
import { submissionAnswerFacts } from "./Submissions";

describe("submissionAnswerFacts", () => {
  it("makes custom CFP answers legible to organizers", () => {
    expect(submissionAnswerFacts({ first_time_speaker: true, audience: ["maintainers", "leaders"], empty: "" }))
      .toEqual([
        { label: "First Time Speaker", value: "Yes" },
        { label: "Audience", value: "maintainers, leaders" },
      ]);
  });
});
