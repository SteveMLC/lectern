import { describe, expect, it } from "vitest";
import { canApplyDecision, statusForDecision } from "./decisions";

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
