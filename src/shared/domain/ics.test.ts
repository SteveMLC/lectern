import { describe, expect, it } from "vitest";
import { buildCalendarInvite } from "./ics";

const base = {
  uid: "session-1@speakerops",
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
});
