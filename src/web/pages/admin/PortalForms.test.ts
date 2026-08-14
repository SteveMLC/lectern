import { describe, expect, it } from "vitest";
import { deriveFieldKey, fieldKeyError, formatAnswerValue, parseOptionList } from "./PortalForms";

describe("deriveFieldKey", () => {
  it("lowercases and joins words with a single underscore", () => {
    expect(deriveFieldKey("Hotel check-in date")).toBe("hotel_check_in_date");
    expect(deriveFieldKey("Flight  cost (USD)")).toBe("flight_cost_usd");
  });

  it("drops leading digits so the key starts with a letter", () => {
    expect(deriveFieldKey("2026 budget")).toBe("budget");
    expect(deriveFieldKey("12 34")).toBe("");
  });

  it("produces keys the API accepts", () => {
    for (const label of ["Nights required", "Dietary needs?", "  Arrival — terminal  "]) {
      expect(deriveFieldKey(label)).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });
});

describe("fieldKeyError", () => {
  it("passes distinct, well-formed keys", () => {
    expect(fieldKeyError([{ label: "Nights", key: "nights" }, { label: "Hotel", key: "hotel_name" }])).toBeNull();
  });

  it("catches a missing key", () => {
    expect(fieldKeyError([{ label: "Nights", key: "" }])).toContain("answer key");
  });

  it("catches a key the API pattern rejects", () => {
    expect(fieldKeyError([{ label: "Nights", key: "2nights" }])).toContain("2nights");
    expect(fieldKeyError([{ label: "Nights", key: "Nights" }])).toContain("lowercase");
  });

  it("catches a duplicate key and names the repeat", () => {
    const message = fieldKeyError([
      { label: "Nights", key: "nights" },
      { label: "Extra nights", key: "nights" },
    ]);
    expect(message).toContain("unique");
    expect(message).toContain("Extra nights");
  });
});

describe("parseOptionList", () => {
  it("trims each choice and drops empty ones", () => {
    expect(parseOptionList("One night, Two nights ,, Three nights")).toEqual([
      "One night",
      "Two nights",
      "Three nights",
    ]);
    expect(parseOptionList("   ")).toEqual([]);
  });
});

describe("formatAnswerValue", () => {
  it("renders booleans, blanks, and lists the way an organizer reads them", () => {
    expect(formatAnswerValue(true)).toBe("Yes");
    expect(formatAnswerValue(false)).toBe("No");
    expect(formatAnswerValue("")).toBe("—");
    expect(formatAnswerValue(null)).toBe("—");
    expect(formatAnswerValue(undefined)).toBe("—");
    expect(formatAnswerValue(2)).toBe("2");
    expect(formatAnswerValue(["Vegan", "Nut allergy"])).toBe("Vegan, Nut allergy");
  });
});
