import { describe, expect, it } from "vitest";
import {
  CORE_CFP_FIELDS,
  dropFieldOnto,
  fieldOrderError,
  isLockedCfpField,
  moveFieldOrder,
  moveFieldToIndex,
} from "./formFields";

describe("isLockedCfpField", () => {
  it("locks the four questions the programme reads off the submission", () => {
    for (const key of ["title", "abstract", "track", "format"]) {
      expect(isLockedCfpField(key)).toBe(true);
    }
  });

  it("leaves an organizer's own questions unlocked", () => {
    for (const key of ["prior_speaking", "workshop_length", "travel_support", "title_slide"]) {
      expect(isLockedCfpField(key)).toBe(false);
    }
  });

  it("locks a key however it is typed, so a custom field cannot shadow a core one", () => {
    expect(isLockedCfpField("  Title ")).toBe(true);
    expect(isLockedCfpField("FORMAT")).toBe(true);
  });

  it("agrees with the core field list it is derived from", () => {
    expect(CORE_CFP_FIELDS.map((field) => field.key)).toEqual(["title", "abstract", "track", "format"]);
    for (const field of CORE_CFP_FIELDS) expect(isLockedCfpField(field.key)).toBe(true);
  });
});

describe("moveFieldOrder", () => {
  const ids = ["ff_a", "ff_b", "ff_c"];

  it("swaps a field with the one above or below it", () => {
    expect(moveFieldOrder(ids, "ff_b", "up")).toEqual(["ff_b", "ff_a", "ff_c"]);
    expect(moveFieldOrder(ids, "ff_b", "down")).toEqual(["ff_a", "ff_c", "ff_b"]);
  });

  it("holds the order at both ends", () => {
    expect(moveFieldOrder(ids, "ff_a", "up")).toEqual(ids);
    expect(moveFieldOrder(ids, "ff_c", "down")).toEqual(ids);
  });

  it("ignores an id that is not on the form", () => {
    expect(moveFieldOrder(ids, "ff_gone", "up")).toEqual(ids);
  });

  it("never mutates the order it was given", () => {
    const original = [...ids];
    moveFieldOrder(ids, "ff_b", "up");
    expect(ids).toEqual(original);
  });

  it("round-trips: down then up puts a field back", () => {
    expect(moveFieldOrder(moveFieldOrder(ids, "ff_a", "down"), "ff_a", "up")).toEqual(ids);
  });
});

describe("moveFieldToIndex", () => {
  const ids = ["ff_a", "ff_b", "ff_c", "ff_d"];

  it("lifts a field out and puts it back at the index asked for", () => {
    expect(moveFieldToIndex(ids, "ff_a", 3)).toEqual(["ff_b", "ff_c", "ff_d", "ff_a"]);
    expect(moveFieldToIndex(ids, "ff_d", 0)).toEqual(["ff_d", "ff_a", "ff_b", "ff_c"]);
  });

  it("holds the order for an index off either end or an unknown field", () => {
    expect(moveFieldToIndex(ids, "ff_a", -1)).toEqual(ids);
    expect(moveFieldToIndex(ids, "ff_a", 4)).toEqual(ids);
    expect(moveFieldToIndex(ids, "ff_gone", 1)).toEqual(ids);
  });
});

describe("dropFieldOnto", () => {
  const ids = ["ff_a", "ff_b", "ff_c"];

  it("gives the dragged field the target's place, dragging either way", () => {
    expect(dropFieldOnto(ids, "ff_a", "ff_c")).toEqual(["ff_b", "ff_c", "ff_a"]);
    expect(dropFieldOnto(ids, "ff_c", "ff_a")).toEqual(["ff_c", "ff_a", "ff_b"]);
  });

  it("holds the order when a field is dropped on itself or on a stranger", () => {
    expect(dropFieldOnto(ids, "ff_b", "ff_b")).toEqual(ids);
    expect(dropFieldOnto(ids, "ff_b", "ff_gone")).toEqual(ids);
  });
});

describe("fieldOrderError", () => {
  const stored = ["ff_a", "ff_b", "ff_c"];

  it("accepts any permutation of the stored fields", () => {
    expect(fieldOrderError(stored, ["ff_c", "ff_a", "ff_b"])).toBeNull();
    expect(fieldOrderError([], [])).toBeNull();
  });

  it("rejects a partial order, because the contract is the whole list", () => {
    expect(fieldOrderError(stored, ["ff_a", "ff_b"])).toContain("Send the whole order.");
  });

  it("rejects a repeated field", () => {
    expect(fieldOrderError(stored, ["ff_a", "ff_a", "ff_b"])).toContain("twice");
  });

  it("names a field that is not on the form", () => {
    expect(fieldOrderError(stored, ["ff_a", "ff_b", "ff_gone"])).toContain("ff_gone");
  });
});
