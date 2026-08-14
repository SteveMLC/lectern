import { describe, expect, it } from "vitest";
import {
  canSubmitAgain,
  combinedLengthMessage,
  combinedLengthUsage,
  exceededLengthRules,
  submissionLimitMessage,
} from "./formLimits";

const programBlock = {
  id: "rule_block",
  label: "Printed programme block",
  fieldKeys: ["title", "abstract"],
  maxChars: 40,
};

describe("combinedLengthUsage", () => {
  it("sums the named fields and reports the remaining budget", () => {
    const usage = combinedLengthUsage(programBlock, { title: "12345", abstract: "1234567890" });
    expect(usage.used).toBe(15);
    expect(usage.remaining).toBe(25);
    expect(usage.exceeded).toBe(false);
    expect(usage.overBy).toBe(0);
  });

  it("counts a missing or hidden field as empty rather than throwing", () => {
    const usage = combinedLengthUsage(programBlock, { title: "abc" });
    expect(usage.used).toBe(3);
    expect(usage.exceeded).toBe(false);
  });

  it("ignores values that are not text", () => {
    const usage = combinedLengthUsage(programBlock, { title: "abc", abstract: 12345 });
    expect(usage.used).toBe(3);
  });

  it("reports how far over the cap the answers run", () => {
    const usage = combinedLengthUsage(programBlock, { title: "a".repeat(30), abstract: "b".repeat(15) });
    expect(usage.used).toBe(45);
    expect(usage.overBy).toBe(5);
    expect(usage.remaining).toBe(0);
    expect(usage.exceeded).toBe(true);
    expect(combinedLengthMessage(usage)).toBe(
      "Printed programme block is 5 characters over its 40-character limit.",
    );
  });

  it("says character in the singular when exactly one over", () => {
    const usage = combinedLengthUsage(programBlock, { title: "a".repeat(41) });
    expect(combinedLengthMessage(usage)).toContain("1 character over");
  });

  it("treats the cap itself as allowed", () => {
    const usage = combinedLengthUsage(programBlock, { title: "a".repeat(40) });
    expect(usage.exceeded).toBe(false);
    expect(usage.remaining).toBe(0);
  });
});

describe("exceededLengthRules", () => {
  it("returns only the broken rules, in rule order", () => {
    const short = { id: "r2", label: "Teaser", fieldKeys: ["title"], maxChars: 5 };
    const broken = exceededLengthRules([programBlock, short], { title: "a".repeat(10) });
    expect(broken.map((usage) => usage.rule.id)).toEqual(["r2"]);
  });

  it("is empty when nothing is over", () => {
    expect(exceededLengthRules([programBlock], { title: "fine" })).toEqual([]);
  });
});

describe("submission capacity", () => {
  it("allows any number when the form sets no limit", () => {
    expect(canSubmitAgain({ limit: null, used: 99 })).toBe(true);
    expect(submissionLimitMessage({ limit: null, used: 99 })).toBeNull();
  });

  it("allows submissions below the limit and blocks at it", () => {
    expect(canSubmitAgain({ limit: 3, used: 2 })).toBe(true);
    expect(canSubmitAgain({ limit: 3, used: 3 })).toBe(false);
    expect(canSubmitAgain({ limit: 3, used: 4 })).toBe(false);
  });

  it("explains the block in the submitter's terms", () => {
    expect(submissionLimitMessage({ limit: 3, used: 3 }))
      .toBe("This call accepts 3 proposals per person, and you already have 3.");
    expect(submissionLimitMessage({ limit: 1, used: 1 }))
      .toBe("This call accepts one proposal per person, and yours is already in.");
  });
});
