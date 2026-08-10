import { describe, expect, it } from "vitest";
import { formatZonedLocalInput, zonedLocalInputToIso } from "./timezone";

describe("event timezone form conversion", () => {
  it("converts Portland event time to UTC in standard time", () => {
    expect(zonedLocalInputToIso("2026-11-05T09:00", "America/Los_Angeles")).toBe(
      "2026-11-05T17:00:00.000Z",
    );
  });

  it("round-trips a scheduled instant through a datetime-local value", () => {
    const iso = "2026-11-05T17:45:00.000Z";
    const local = formatZonedLocalInput(iso, "America/Los_Angeles");
    expect(local).toBe("2026-11-05T09:45");
    expect(zonedLocalInputToIso(local, "America/Los_Angeles")).toBe(iso);
  });
});
