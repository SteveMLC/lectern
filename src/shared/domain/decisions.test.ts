import { describe, expect, it } from "vitest";
import { canApplyDecision, reviewerIdentity, statusForDecision } from "./decisions";

describe("review decisions", () => {
  it("maps organizer language to submission statuses", () => {
    expect(statusForDecision("approve")).toBe("accepted");
    expect(statusForDecision("maybe")).toBe("waitlisted");
    expect(statusForDecision("deny")).toBe("rejected");
  });

  it("allows normal review transitions", () => {
    expect(canApplyDecision("submitted", "approve")).toBe(true);
    expect(canApplyDecision("under_review", "maybe")).toBe(true);
    expect(canApplyDecision("waitlisted", "deny")).toBe(true);
    expect(canApplyDecision("rejected", "approve")).toBe(true);
  });

  it("keeps repeated acceptance safe but blocks silent demotion", () => {
    expect(canApplyDecision("accepted", "approve")).toBe(true);
    expect(canApplyDecision("accepted", "maybe")).toBe(false);
    expect(canApplyDecision("accepted", "deny")).toBe(false);
  });

  it("never decides drafts or withdrawn proposals", () => {
    expect(canApplyDecision("draft", "approve")).toBe(false);
    expect(canApplyDecision("withdrawn", "deny")).toBe(false);
  });
});

describe("reviewerIdentity", () => {
  it("defaults to the exact pre-feature identity so upgrades never duplicate notes", () => {
    for (const input of [undefined, "", "   "]) {
      expect(reviewerIdentity(input)).toEqual({
        name: "Organizer",
        email: "organizer@speakerops.local",
      });
    }
  });

  it("gives each name a stable address: same name replaces, different names stack", () => {
    const priya = reviewerIdentity("Priya Sharma");
    expect(priya).toEqual({ name: "Priya Sharma", email: "priya.sharma@reviewers.speakerops.local" });
    // Deterministic: the same name always maps to the same address.
    expect(reviewerIdentity("Priya Sharma")).toEqual(priya);
    // Different people never collide onto one row.
    expect(reviewerIdentity("Marco Reyes").email).not.toBe(priya.email);
  });

  it("normalizes punctuation and case without losing the display name", () => {
    const identity = reviewerIdentity("  O'Brien, Sam  ");
    expect(identity.name).toBe("O'Brien, Sam");
    expect(identity.email).toBe("o.brien.sam@reviewers.speakerops.local");
  });

  it("keeps a stable identity for names with no ascii alphanumerics", () => {
    const first = reviewerIdentity("李华");
    expect(first.name).toBe("李华");
    expect(first.email).toMatch(/^reviewer\.[0-9a-f]+@reviewers\.speakerops\.local$/);
    expect(reviewerIdentity("李华")).toEqual(first);
    expect(reviewerIdentity("田中")).not.toEqual(first);
  });
});
