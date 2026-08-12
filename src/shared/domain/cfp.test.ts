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

// ---------------------------------------------------------------------------
// Post-submission co-presenter editing contract
// ---------------------------------------------------------------------------

import { UpdateSpeakerProposalRequest } from "../contracts";

describe("UpdateSpeakerProposalRequest co-presenters", () => {
  const base = {
    title: "A sufficiently long proposal title",
    abstract: "An abstract comfortably longer than the twenty character minimum.",
    answers: {},
  };

  it("treats an omitted coSpeakers field as leave-unchanged", () => {
    const parsed = UpdateSpeakerProposalRequest.parse(base);
    expect(parsed.coSpeakers).toBeUndefined();
  });

  it("accepts an explicit empty array as remove-all", () => {
    const parsed = UpdateSpeakerProposalRequest.parse({ ...base, coSpeakers: [] });
    expect(parsed.coSpeakers).toEqual([]);
  });

  it("accepts up to two co-presenters with a free-text role label", () => {
    const parsed = UpdateSpeakerProposalRequest.parse({
      ...base,
      coSpeakers: [
        { name: "Marcus Okafor", email: "marcus@example.com", company: "Cloudreach Labs", title: "Co-author" },
        { name: "Lin Zhao", email: "lin@example.com" },
      ],
    });
    expect(parsed.coSpeakers).toHaveLength(2);
    expect(parsed.coSpeakers?.[0]?.title).toBe("Co-author");
  });

  it("rejects a third co-presenter and a missing email", () => {
    expect(UpdateSpeakerProposalRequest.safeParse({
      ...base,
      coSpeakers: [
        { name: "A B", email: "a@example.com" },
        { name: "C D", email: "c@example.com" },
        { name: "E F", email: "e@example.com" },
      ],
    }).success).toBe(false);
    expect(UpdateSpeakerProposalRequest.safeParse({
      ...base,
      coSpeakers: [{ name: "A B" }],
    }).success).toBe(false);
  });
});
