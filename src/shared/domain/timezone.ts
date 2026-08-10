function partsFor(value: Date, timeZone: string): Record<string, string> {
  return Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(value)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
}

/** Format an instant for a browser datetime-local input in the event timezone. */
export function formatZonedLocalInput(iso: string, timeZone: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) throw new TypeError(`Invalid timestamp: ${iso}`);
  const parts = partsFor(date, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/** Convert a datetime-local value interpreted in an IANA timezone into UTC ISO. */
export function zonedLocalInputToIso(local: string, timeZone: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!match) throw new TypeError(`Invalid local date/time: ${local}`);
  const [, year, month, day, hour, minute] = match;
  const wallClockAsUtc = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
  );
  const observed = partsFor(new Date(wallClockAsUtc), timeZone);
  const observedAsUtc = Date.UTC(
    Number(observed.year),
    Number(observed.month) - 1,
    Number(observed.day),
    Number(observed.hour),
    Number(observed.minute),
    Number(observed.second),
  );
  const offset = observedAsUtc - wallClockAsUtc;
  return new Date(wallClockAsUtc - offset).toISOString();
}
