import { describe, expect, it } from "vitest";
import { canEditSpeakerProposal, isCfpOpen, speakerProposalLockReason } from "./cfp";

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

describe("speakerProposalLockReason", () => {
  const form = { isOpen: true, opensAt: null, closesAt: "2026-08-25T07:00:00.000Z" };

  it("names the actual close date instead of blaming a committee decision", () => {
    expect(speakerProposalLockReason(form, "submitted", "2026-08-25T07:00:00.000Z"))
      .toBe("Editing is locked because the call for speakers closed on August 25, 2026.");
  });

  it("distinguishes decisions and organizer closure", () => {
    expect(speakerProposalLockReason(form, "accepted", "2026-08-24T12:00:00.000Z"))
      .toBe("Editing is locked because the committee has made a decision.");
    expect(speakerProposalLockReason({ ...form, isOpen: false }, "submitted", "2026-08-24T12:00:00.000Z"))
      .toBe("Editing is locked because the organizer closed the call for speakers.");
  });

  it("returns null while editing is allowed", () => {
    expect(speakerProposalLockReason(form, "submitted", "2026-08-24T12:00:00.000Z")).toBeNull();
  });
});

describe("canEditSpeakerProposal", () => {
  const form = { isOpen: true, opensAt: null, closesAt: "2026-08-25T07:00:00.000Z" };

  it("allows undecided proposals before close", () => {
    expect(canEditSpeakerProposal(form, "submitted", "2026-08-24T12:00:00.000Z")).toBe(true);
    expect(canEditSpeakerProposal(form, "under_review", "2026-08-24T12:00:00.000Z")).toBe(true);
  });

  it("locks at close and after a decision", () => {
    expect(canEditSpeakerProposal(form, "submitted", "2026-08-25T07:00:00.000Z")).toBe(false);
    expect(canEditSpeakerProposal(form, "accepted", "2026-08-24T12:00:00.000Z")).toBe(false);
    expect(canEditSpeakerProposal(form, "waitlisted", "2026-08-24T12:00:00.000Z")).toBe(false);
  });
});
