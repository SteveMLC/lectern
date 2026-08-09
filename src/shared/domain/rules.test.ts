import { describe, expect, it } from "vitest";
import type { ConditionalRule, FormField } from "../contracts";
import { isFieldVisible, missingRequiredFields, pruneAnswers } from "./rules";

function field(key: string, overrides: Partial<FormField> = {}): FormField {
  return {
    id: `ff_${key}`,
    formId: "form_cfp",
    key,
    label: key,
    fieldType: "select",
    required: false,
    sortOrder: 0,
    helpText: null,
    options: null,
    ...overrides,
  };
}

const workshopRule: ConditionalRule = {
  id: "rule_wslength",
  formId: "form_cfp",
  sourceFieldKey: "format",
  operator: "in",
  values: ["workshop"],
  action: "show",
  targetFieldKey: "workshop_length",
};

describe("isFieldVisible", () => {
  it("shows untargeted fields unconditionally", () => {
    expect(isFieldVisible(field("prior_speaking"), [workshopRule], { format: "talk", answers: {} }))
      .toBe(true);
  });

  it("hides a show-ruled field when the source does not match", () => {
    expect(isFieldVisible(field("workshop_length"), [workshopRule], { format: "talk", answers: {} }))
      .toBe(false);
  });

  it("shows a show-ruled field when the source matches", () => {
    expect(
      isFieldVisible(field("workshop_length"), [workshopRule], { format: "workshop", answers: {} }),
    ).toBe(true);
  });

  it("lets a matching hide rule override a matching show rule", () => {
    const hide: ConditionalRule = { ...workshopRule, id: "rule_hide", action: "hide" };
    expect(
      isFieldVisible(field("workshop_length"), [workshopRule, hide], {
        format: "workshop",
        answers: {},
      }),
    ).toBe(false);
  });

  it("reads custom-field sources from answers", () => {
    const rule: ConditionalRule = {
      ...workshopRule,
      id: "rule_travel",
      sourceFieldKey: "travel_support",
      operator: "equals",
      values: ["true"],
      targetFieldKey: "travel_notes",
    };
    expect(
      isFieldVisible(field("travel_notes"), [rule], { format: "talk", answers: { travel_support: true } }),
    ).toBe(true);
    expect(
      isFieldVisible(field("travel_notes"), [rule], { format: "talk", answers: {} }),
    ).toBe(false);
  });
});

describe("missingRequiredFields", () => {
  const fields = [
    field("prior_speaking", { required: true }),
    field("workshop_length", { required: true }),
  ];

  it("does not require a hidden field", () => {
    const missing = missingRequiredFields(fields, [workshopRule], { format: "talk", answers: {} });
    expect(missing.map((f) => f.key)).toEqual(["prior_speaking"]);
  });

  it("requires the field once its show rule matches", () => {
    const missing = missingRequiredFields(fields, [workshopRule], {
      format: "workshop",
      answers: { prior_speaking: "First time" },
    });
    expect(missing.map((f) => f.key)).toEqual(["workshop_length"]);
  });

  it("is satisfied by non-empty answers", () => {
    const missing = missingRequiredFields(fields, [workshopRule], {
      format: "workshop",
      answers: { prior_speaking: "First time", workshop_length: "90 minutes" },
    });
    expect(missing).toEqual([]);
  });
});

describe("pruneAnswers", () => {
  it("drops unknown keys and answers to hidden fields", () => {
    const fields = [field("prior_speaking"), field("workshop_length")];
    const pruned = pruneAnswers(fields, [workshopRule], {
      format: "talk",
      answers: {
        prior_speaking: "First time",
        workshop_length: "90 minutes",
        evil_extra: "<script>",
      },
    });
    expect(pruned).toEqual({ prior_speaking: "First time" });
  });
});
