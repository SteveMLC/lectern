import { describe, expect, it } from "vitest";
import { buildCalendarCollection, buildCalendarInvite } from "./ics";

const base = {
  uid: "session-1@lectern",
  eventName: "Horizon Dev Summit",
  sessionTitle: "Agents, Everywhere",
  description: "A practical session; bring questions.\nArrive early.",
  location: "Main Hall, Level 2",
  startsAt: "2026-10-14T17:00:00Z",
  endsAt: "2026-10-14T17:45:00Z",
  generatedAt: "2026-08-10T04:00:00Z",
};

describe("buildCalendarInvite", () => {
  it("produces a complete CRLF-delimited UTC calendar event", () => {
    const ics = buildCalendarInvite(base);
    expect(ics).toContain("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n");
    expect(ics).toContain("DTSTART:20261014T170000Z\r\n");
    expect(ics).toContain("DTEND:20261014T174500Z\r\n");
    expect(ics).toContain("END:VEVENT\r\nEND:VCALENDAR\r\n");
  });

  it("escapes calendar punctuation and newlines", () => {
    const ics = buildCalendarInvite(base);
    expect(ics).toContain("Agents\\, Everywhere");
    expect(ics).toContain("session\\; bring questions.\\nArrive early.");
    expect(ics).toContain("Main Hall\\, Level 2");
  });

  it("rejects inverted events", () => {
    expect(() => buildCalendarInvite({ ...base, endsAt: base.startsAt })).toThrow(RangeError);
  });

  it("exports multiple sessions in one calendar", () => {
    const ics = buildCalendarCollection([
      base,
      { ...base, uid: "session-2@lectern", sessionTitle: "Second session" },
    ]);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(ics).toContain("SUMMARY:Second session — Horizon Dev Summit");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });
});

describe("calendar invitations vs publications", () => {
  const base = {
    uid: "ses_1@lectern",
    eventName: "Horizon Dev Summit 2026",
    sessionTitle: "Agents in Production",
    description: "What breaks first.",
    location: "Main Hall",
    startsAt: "2026-10-14T17:00:00.000Z",
    endsAt: "2026-10-14T17:45:00.000Z",
    generatedAt: "2026-08-14T12:00:00.000Z",
  };

  it("publishes when no organizer or attendee is supplied", () => {
    const ics = buildCalendarInvite(base);
    expect(ics).toContain("METHOD:PUBLISH");
    expect(ics).not.toContain("ATTENDEE");
    expect(ics).not.toContain("ORGANIZER");
  });

  it("invites when both organizer and attendee are supplied", () => {
    // Long property lines are folded per RFC 5545; unfold the way a client does.
    const ics = buildCalendarInvite({
      ...base,
      organizer: { name: "Horizon Dev Summit 2026", email: "lectern@qualora.io" },
      attendee: { name: "Ada Okafor", email: "ada@nimbuslabs.example" },
    }).replace(/\r\n /g, "");
    expect(ics).toContain("METHOD:REQUEST");
    expect(ics).toContain("ORGANIZER;CN=Horizon Dev Summit 2026:mailto:lectern@qualora.io");
    expect(ics).toContain("RSVP=TRUE:mailto:ada@nimbuslabs.example");
    expect(ics).toContain("PARTSTAT=NEEDS-ACTION");
    expect(ics).toContain("SEQUENCE:0");
  });

  it("stays a publication when only one side is known", () => {
    const ics = buildCalendarInvite({ ...base, organizer: { name: "X", email: "x@y.z" } });
    expect(ics).toContain("METHOD:PUBLISH");
  });
});
