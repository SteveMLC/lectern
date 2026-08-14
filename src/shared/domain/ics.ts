export interface CalendarInviteInput {
  uid: string;
  eventName: string;
  sessionTitle: string;
  description: string;
  location: string;
  startsAt: string;
  endsAt: string;
  generatedAt: string;
  /**
   * Supply both to emit a real invitation (METHOD:REQUEST with ORGANIZER and
   * ATTENDEE), which Gmail, Outlook, and iCal render with Accept/Decline.
   * Omit them for a published event — a downloadable entry with no RSVP.
   */
  organizer?: { name: string; email: string };
  attendee?: { name: string; email: string };
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
  // An invitation needs a method, an organizer, and an attendee; without all
  // three, mail clients file it as a published event with no RSVP.
  const isInvitation = Boolean(input.organizer && input.attendee);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Lectern//Program Calendar//EN",
    "CALSCALE:GREGORIAN",
    isInvitation ? "METHOD:REQUEST" : "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${escapeIcs(input.uid)}`,
    `DTSTAMP:${icsDate(input.generatedAt)}`,
    `DTSTART:${icsDate(input.startsAt)}`,
    `DTEND:${icsDate(input.endsAt)}`,
    `SUMMARY:${escapeIcs(`${input.sessionTitle} — ${input.eventName}`)}`,
    `DESCRIPTION:${escapeIcs(input.description)}`,
    `LOCATION:${escapeIcs(input.location)}`,
    ...(input.organizer
      ? [`ORGANIZER;CN=${escapeIcs(input.organizer.name)}:mailto:${input.organizer.email}`]
      : []),
    ...(input.attendee
      ? [`ATTENDEE;CN=${escapeIcs(input.attendee.name)};ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:${input.attendee.email}`]
      : []),
    ...(isInvitation ? ["SEQUENCE:0"] : []),
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return `${lines.map(fold).join("\r\n")}\r\n`;
}

export function buildCalendarCollection(inputs: CalendarInviteInput[]): string {
  const events = inputs.map((input) => {
    const single = buildCalendarInvite(input);
    const match = single.match(/BEGIN:VEVENT\r\n[\s\S]*?END:VEVENT\r\n/);
    if (!match) throw new Error("Calendar event could not be rendered.");
    return match[0];
  });
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Lectern//Personal Schedule//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...events.map((event) => event.trimEnd()),
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}
