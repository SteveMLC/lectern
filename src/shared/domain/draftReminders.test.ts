import { describe, expect, it } from "vitest";
import { DRAFT_REMINDER_WINDOW_MS, shouldRemindDraft } from "./draftReminders";

const NOW = "2026-08-14T12:00:00.000Z";
const iso = (offsetMs: number) => new Date(Date.parse(NOW) + offsetMs).toISOString();

const candidate = {
  email: "ada@example.com",
  closesAt: iso(3 * 24 * 60 * 60 * 1000),
  remindedAt: null,
};

describe("shouldRemindDraft", () => {
  it("reminds an un-reminded draft whose close date is days away", () => {
    expect(shouldRemindDraft(candidate, NOW)).toBe(true);
  });

  it("stays silent when the organizer set no close date", () => {
    expect(shouldRemindDraft({ ...candidate, closesAt: null }, NOW)).toBe(false);
  });

  it("stays silent once the close date has passed", () => {
    expect(shouldRemindDraft({ ...candidate, closesAt: iso(-60 * 1000) }, NOW)).toBe(false);
    expect(shouldRemindDraft({ ...candidate, closesAt: NOW }, NOW)).toBe(false);
  });

  it("stays silent while the close date is further off than the window", () => {
    expect(shouldRemindDraft({ ...candidate, closesAt: iso(DRAFT_REMINDER_WINDOW_MS + 1000) }, NOW)).toBe(false);
    expect(shouldRemindDraft({ ...candidate, closesAt: iso(DRAFT_REMINDER_WINDOW_MS) }, NOW)).toBe(true);
  });

  it("never reminds the same draft twice", () => {
    expect(shouldRemindDraft({ ...candidate, remindedAt: iso(-24 * 60 * 60 * 1000) }, NOW)).toBe(false);
  });

  it("needs somewhere to send it", () => {
    expect(shouldRemindDraft({ ...candidate, email: null }, NOW)).toBe(false);
    expect(shouldRemindDraft({ ...candidate, email: "   " }, NOW)).toBe(false);
  });

  it("treats an unreadable close date as no close date", () => {
    expect(shouldRemindDraft({ ...candidate, closesAt: "next Tuesday" }, NOW)).toBe(false);
  });

  it("refuses to guess at a broken clock", () => {
    expect(() => shouldRemindDraft(candidate, "not a date")).toThrow(TypeError);
  });
});
