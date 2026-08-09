import { describe, expect, it } from "vitest";
import { isCfpOpen } from "./cfp";

const NOW = "2026-08-09T20:00:00Z";

describe("isCfpOpen", () => {
  it("is open inside the window", () => {
    expect(
      isCfpOpen({ isOpen: true, opensAt: "2026-08-01T00:00:00Z", closesAt: "2026-09-01T00:00:00Z" }, NOW),
    ).toBe(true);
  });

  it("is closed when the organizer switch is off, whatever the dates say", () => {
    expect(
      isCfpOpen({ isOpen: false, opensAt: "2026-08-01T00:00:00Z", closesAt: "2026-09-01T00:00:00Z" }, NOW),
    ).toBe(false);
  });

  it("is closed before opensAt and at/after closesAt", () => {
    expect(isCfpOpen({ isOpen: true, opensAt: "2026-08-10T00:00:00Z", closesAt: null }, NOW)).toBe(false);
    expect(isCfpOpen({ isOpen: true, opensAt: null, closesAt: "2026-08-09T20:00:00Z" }, NOW)).toBe(false);
  });

  it("treats null bounds as unbounded", () => {
    expect(isCfpOpen({ isOpen: true, opensAt: null, closesAt: null }, NOW)).toBe(true);
  });
});
