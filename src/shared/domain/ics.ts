export interface CalendarInviteInput {
  uid: string;
  eventName: string;
  sessionTitle: string;
  description: string;
  location: string;
  startsAt: string;
  endsAt: string;
  generatedAt: string;
}

function icsDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError(`Invalid calendar timestamp: ${value}`);
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function escapeIcs(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

/** RFC 5545 content-line folding for the ASCII-heavy values we generate. */
function fold(line: string): string {
  const chunks: string[] = [];
  let rest = line;
  while (rest.length > 73) {
    chunks.push(rest.slice(0, 73));
    rest = rest.slice(73);
  }
  chunks.push(rest);
  return chunks.join("\r\n ");
}

export function buildCalendarInvite(input: CalendarInviteInput): string {
  if (Date.parse(input.endsAt) <= Date.parse(input.startsAt)) {
    throw new RangeError("Calendar event must end after it starts.");
  }
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SpeakerOps//Program Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${escapeIcs(input.uid)}`,
    `DTSTAMP:${icsDate(input.generatedAt)}`,
    `DTSTART:${icsDate(input.startsAt)}`,
    `DTEND:${icsDate(input.endsAt)}`,
    `SUMMARY:${escapeIcs(`${input.sessionTitle} — ${input.eventName}`)}`,
    `DESCRIPTION:${escapeIcs(input.description)}`,
    `LOCATION:${escapeIcs(input.location)}`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return `${lines.map(fold).join("\r\n")}\r\n`;
}
