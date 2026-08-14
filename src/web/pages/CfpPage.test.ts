import { describe, expect, it } from "vitest";
import { blankFormAfterSubmission, portalRedirectCountdownText } from "./CfpPage";

describe("portalRedirectCountdownText", () => {
  it("says where the submitter is going and how long they have", () => {
    expect(portalRedirectCountdownText(10)).toBe("Taking you to your speaker portal in 10 seconds…");
    expect(portalRedirectCountdownText(7)).toBe("Taking you to your speaker portal in 7 seconds…");
  });

  it("keeps the last second singular", () => {
    expect(portalRedirectCountdownText(1)).toBe("Taking you to your speaker portal in 1 second…");
  });

  it("never counts past zero", () => {
    expect(portalRedirectCountdownText(0)).toBe("Taking you to your speaker portal now…");
    expect(portalRedirectCountdownText(-3)).toBe("Taking you to your speaker portal now…");
  });
});

describe("blankFormAfterSubmission", () => {
  it("clears every field for a submitter without an account", () => {
    expect(blankFormAfterSubmission(null)).toEqual({
      name: "",
      email: "",
      company: "",
      role: "",
      bio: "",
      title: "",
      abstract: "",
      trackId: "",
      format: "talk",
      answers: {},
      coSpeakers: [],
    });
  });

  it("keeps a signed-in identity, which the form renders read-only", () => {
    const next = blankFormAfterSubmission({ name: "Ada Okafor", email: "ada@example.com" });
    expect(next.name).toBe("Ada Okafor");
    expect(next.email).toBe("ada@example.com");
    expect(next.title).toBe("");
    expect(next.abstract).toBe("");
  });

  it("hands back fresh answers and co-presenters, so nothing leaks into the next proposal", () => {
    const first = blankFormAfterSubmission(null);
    first.answers["first_time_speaker"] = true;
    first.coSpeakers.push({ name: "Lin Zhao", email: "lin@example.com", company: "", role: "", bio: "" });

    const second = blankFormAfterSubmission(null);
    expect(second.answers).toEqual({});
    expect(second.coSpeakers).toEqual([]);
  });
});
