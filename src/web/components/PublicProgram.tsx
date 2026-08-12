import { useMemo, useState } from "react";
import type {
  PublicScheduleResponse,
  PublicSession,
  PublicSessionsResponse,
  PublicSpeaker,
  PublicSpeakersResponse,
} from "../../shared/contracts";
import { Badge, Button, Card, EmptyState, Input, Select } from "./ui";

type ProgramView = "schedule" | "sessions" | "speakers";

function localDay(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric", month: "2-digit", day: "2-digit", timeZone: timezone,
  }).format(new Date(iso));
}

function formatDay(day: string): string {
  return new Intl.DateTimeFormat("en", {
    weekday: "long", month: "long", day: "numeric", timeZone: "UTC",
  }).format(new Date(`${day}T12:00:00Z`));
}

function formatTimeRange(startsAt: string, endsAt: string, timezone: string): string {
  const formatter = new Intl.DateTimeFormat("en", {
    hour: "numeric", minute: "2-digit", timeZone: timezone,
  });
  return `${formatter.format(new Date(startsAt))}–${formatter.format(new Date(endsAt))}`;
}

function surname(name: string): string {
  return name.trim().split(/\s+/).at(-1)?.toLocaleLowerCase() ?? name.toLocaleLowerCase();
}

export function sortSpeakersBySurname(speakers: PublicSpeaker[]): PublicSpeaker[] {
  return [...speakers].sort((a, b) => surname(a.name).localeCompare(surname(b.name)) || a.name.localeCompare(b.name));
}

export function filterPublicSessions(
  sessions: PublicSession[],
  schedule: PublicScheduleResponse,
  filters: { query: string; trackId: string; format: string; roomId: string },
): PublicSession[] {
  const query = filters.query.trim().toLocaleLowerCase();
  const slotBySession = new Map(schedule.slots.map((slot) => [slot.session.id, slot]));
  return sessions.filter((session) => {
    if (query && ![session.title, ...session.speakers.map((speaker) => speaker.name)]
      .some((value) => value.toLocaleLowerCase().includes(query))) return false;
    if (filters.trackId && session.track?.id !== filters.trackId) return false;
    if (filters.format && session.format !== filters.format) return false;
    if (filters.roomId && slotBySession.get(session.id)?.room?.id !== filters.roomId) return false;
    return true;
  });
}

function SpeakerPortrait({ speaker, className = "size-12" }: { speaker: PublicSpeaker; className?: string }) {
  const initials = speaker.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  return speaker.headshotUrl ? (
    <img src={speaker.headshotUrl} alt={`${speaker.name} headshot`} className={`${className} rounded-full object-cover grayscale`} />
  ) : (
    <span aria-hidden="true" className={`${className} inline-flex items-center justify-center rounded-full bg-zinc-900 text-xs font-semibold text-white`}>{initials}</span>
  );
}

export function PublicProgram({
  schedule,
  sessions,
  speakers,
}: {
  schedule: PublicScheduleResponse;
  sessions: PublicSessionsResponse;
  speakers: PublicSpeakersResponse;
}) {
  const [view, setView] = useState<ProgramView>("schedule");
  const [query, setQuery] = useState("");
  const [trackId, setTrackId] = useState("");
  const [format, setFormat] = useState("");
  const [roomId, setRoomId] = useState("");
  const days = useMemo(
    () => [...new Set(schedule.slots.map((slot) => localDay(slot.startsAt, schedule.timezone)))].sort(),
    [schedule],
  );
  const [day, setDay] = useState(days[0] ?? "");
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedSpeakerId, setSelectedSpeakerId] = useState<string | null>(null);

  const filteredSessions = useMemo(
    () => filterPublicSessions(sessions.sessions, schedule, { query, trackId, format, roomId }),
    [sessions.sessions, schedule, query, trackId, format, roomId],
  );
  const filteredIds = useMemo(() => new Set(filteredSessions.map((session) => session.id)), [filteredSessions]);
  const visibleSlots = schedule.slots.filter(
    (slot) => filteredIds.has(slot.session.id) && (!day || localDay(slot.startsAt, schedule.timezone) === day),
  );
  const sortedSpeakers = useMemo(() => sortSpeakersBySurname(speakers.speakers), [speakers.speakers]);
  const filteredSpeakers = sortedSpeakers.filter((speaker) => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return true;
    return [speaker.name, speaker.title, speaker.company].some((value) => value?.toLocaleLowerCase().includes(needle));
  });
  const selectedSession = selectedSessionId
    ? sessions.sessions.find((session) => session.id === selectedSessionId) ?? null
    : null;
  const selectedSlot = selectedSession ? schedule.slots.find((slot) => slot.session.id === selectedSession.id) ?? null : null;
  const selectedSpeaker = selectedSpeakerId
    ? speakers.speakers.find((speaker) => speaker.id === selectedSpeakerId) ?? null
    : null;
  const speakerSessions = selectedSpeaker
    ? sessions.sessions.filter((session) => session.speakers.some((speaker) => speaker.id === selectedSpeaker.id))
    : [];
  const tracks = [...new Map(sessions.sessions.flatMap((session) => session.track ? [[session.track.id, session.track]] : [])).values()];
  const formats = [...new Set(sessions.sessions.map((session) => session.format))].sort();
  const rooms = [...new Map(schedule.slots.flatMap((slot) => slot.room ? [[slot.room.id, slot.room]] : [])).values()];

  function changeView(next: ProgramView) {
    setView(next);
    setSelectedSessionId(null);
    setSelectedSpeakerId(null);
  }

  return (
    <Card className="overflow-hidden" id="program">
      <div className="border-b border-zinc-200 bg-zinc-50/70 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Explore the program</h2>
            <p className="mt-1 text-sm text-zinc-600">Search every session and speaker, then narrow by track, format, room, or day.</p>
          </div>
          <div className="flex rounded-lg border border-zinc-200 bg-white p-1" role="tablist" aria-label="Program view">
            {(["schedule", "sessions", "speakers"] as ProgramView[]).map((item) => (
              <button
                key={item}
                type="button"
                role="tab"
                aria-selected={view === item}
                onClick={() => changeView(item)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize ${view === item ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-50"}`}
              >{item}</button>
            ))}
          </div>
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-[minmax(12rem,2fr)_repeat(3,minmax(8rem,1fr))]">
          <Input
            type="search"
            aria-label={view === "speakers" ? "Search speaker gallery" : "Search session titles and speaker names"}
            placeholder={view === "speakers" ? "Search speakers" : "Search titles or speakers"}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {view !== "speakers" ? <>
            <Select aria-label="Filter program by track" value={trackId} onChange={(event) => setTrackId(event.target.value)}>
              <option value="">All tracks</option>
              {tracks.map((track) => <option key={track.id} value={track.id}>{track.name}</option>)}
            </Select>
            <Select aria-label="Filter program by format" value={format} onChange={(event) => setFormat(event.target.value)}>
              <option value="">All formats</option>
              {formats.map((value) => <option key={value} value={value}>{value}</option>)}
            </Select>
            <Select aria-label="Filter program by room" value={roomId} onChange={(event) => setRoomId(event.target.value)}>
              <option value="">All rooms</option>
              {rooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
            </Select>
          </> : null}
        </div>
        <p className="mt-2 text-xs font-medium text-zinc-500" role="status" aria-live="polite">
          {view === "speakers" ? `${filteredSpeakers.length} speaker${filteredSpeakers.length === 1 ? "" : "s"}` : `${filteredSessions.length} session${filteredSessions.length === 1 ? "" : "s"}`}
        </p>
      </div>

      <div className="p-5">
        {selectedSession ? (
          <div>
            <Button variant="ghost" className="mb-4 px-0" onClick={() => setSelectedSessionId(null)}>← Back to {view}</Button>
            <div className="flex flex-wrap gap-2"><Badge tone="indigo">{selectedSession.format}</Badge>{selectedSession.track ? <Badge>{selectedSession.track.name}</Badge> : null}</div>
            <h3 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-900">{selectedSession.title}</h3>
            {selectedSlot ? <p className="mt-2 text-sm font-medium text-zinc-600">{formatDay(localDay(selectedSlot.startsAt, schedule.timezone))} · {formatTimeRange(selectedSlot.startsAt, selectedSlot.endsAt, schedule.timezone)} · {selectedSlot.room?.name ?? "Room pending"}</p> : <p className="mt-2 text-sm text-zinc-500">Time and room coming soon.</p>}
            <p className="mt-5 max-w-3xl text-sm leading-6 text-zinc-700">{selectedSession.abstract}</p>
            <div className="mt-5 flex flex-wrap gap-3">{selectedSession.speakers.map((speaker) => <button key={speaker.id} type="button" className="text-sm font-medium text-accent hover:underline" onClick={() => { setSelectedSessionId(null); setSelectedSpeakerId(speaker.id); setView("speakers"); }}>{speaker.name}{speaker.company ? ` · ${speaker.company}` : ""}</button>)}</div>
          </div>
        ) : selectedSpeaker ? (
          <div>
            <Button variant="ghost" className="mb-4 px-0" onClick={() => setSelectedSpeakerId(null)}>← Back to speakers</Button>
            <div className="flex items-start gap-4"><SpeakerPortrait speaker={selectedSpeaker} className="size-20" /><div><h3 className="text-2xl font-semibold tracking-tight text-zinc-900">{selectedSpeaker.name}</h3><p className="mt-1 text-sm text-zinc-600">{[selectedSpeaker.title, selectedSpeaker.company].filter(Boolean).join(" · ")}</p>{selectedSpeaker.location ? <p className="mt-1 text-xs text-zinc-500">{selectedSpeaker.location}</p> : null}</div></div>
            <p className="mt-5 max-w-3xl text-sm leading-6 text-zinc-700">{selectedSpeaker.bio ?? "Bio coming soon."}</p>
            <h4 className="mt-6 text-sm font-semibold uppercase tracking-wide text-zinc-500">Sessions</h4>
            <div className="mt-2 divide-y divide-zinc-100">{speakerSessions.map((session) => <button key={session.id} type="button" className="block w-full py-3 text-left text-sm font-medium text-zinc-900 hover:text-accent" onClick={() => { setSelectedSpeakerId(null); setSelectedSessionId(session.id); setView("sessions"); }}>{session.title} →</button>)}</div>
          </div>
        ) : view === "schedule" ? (
          <div>
            <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Schedule day">
              {days.map((value, index) => <Button key={value} className="px-3 py-1.5 text-xs" variant={day === value ? "primary" : "secondary"} onClick={() => setDay(value)}>Day {index + 1} · {formatDay(value)}</Button>)}
            </div>
            {visibleSlots.length === 0 ? <EmptyState title="No sessions match" body="Try another day or clear a filter." /> : <div className="overflow-hidden rounded-lg border border-zinc-200"><div className="hidden grid-cols-[9rem_1fr_12rem] gap-4 bg-zinc-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 md:grid"><span>Time</span><span>Session</span><span>Location</span></div>{visibleSlots.map((slot) => <button key={slot.id} type="button" className="grid w-full gap-1 border-t border-zinc-100 px-4 py-4 text-left first:border-t-0 hover:bg-zinc-50 md:grid-cols-[9rem_1fr_12rem] md:gap-4" onClick={() => setSelectedSessionId(slot.session.id)}><span className="text-xs font-semibold text-zinc-600">{formatTimeRange(slot.startsAt, slot.endsAt, schedule.timezone)}</span><span><span className="block text-sm font-semibold text-zinc-900">{slot.session.title}</span><span className="mt-1 block text-xs text-zinc-500">{slot.session.speakers.map((speaker) => speaker.name).join(", ") || "Speaker TBA"}</span></span><span className="text-xs text-zinc-600">{slot.room?.name ?? "Room pending"}</span></button>)}</div>}
          </div>
        ) : view === "sessions" ? (
          filteredSessions.length === 0 ? <EmptyState title="No sessions match" body="Clear a filter or try another search." /> : <div className="grid gap-3 md:grid-cols-2">{filteredSessions.map((session) => { const slot = schedule.slots.find((candidate) => candidate.session.id === session.id); return <button key={session.id} type="button" className="rounded-lg border border-zinc-200 p-4 text-left hover:border-zinc-400 hover:bg-zinc-50" onClick={() => setSelectedSessionId(session.id)}><div className="flex flex-wrap gap-1"><Badge tone="indigo">{session.format}</Badge>{session.track ? <Badge>{session.track.name}</Badge> : null}</div><h3 className="mt-3 text-sm font-semibold text-zinc-900">{session.title}</h3><p className="mt-2 line-clamp-2 text-sm leading-5 text-zinc-600">{session.abstract}</p><p className="mt-3 text-xs text-zinc-500">{slot ? `${formatTimeRange(slot.startsAt, slot.endsAt, schedule.timezone)} · ${slot.room?.name ?? "Room pending"}` : "Schedule coming soon"}</p></button>; })}</div>
        ) : filteredSpeakers.length === 0 ? <EmptyState title="No speakers match" body="Try a name, company, or role." /> : (
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">{filteredSpeakers.map((speaker) => <button key={speaker.id} type="button" className="flex items-center gap-3 rounded-lg border border-zinc-200 p-4 text-left hover:border-zinc-400 hover:bg-zinc-50" onClick={() => setSelectedSpeakerId(speaker.id)}><SpeakerPortrait speaker={speaker} /><span className="min-w-0"><span className="block truncate text-sm font-semibold text-zinc-900">{speaker.name}</span><span className="mt-0.5 block truncate text-xs text-zinc-500">{[speaker.title, speaker.company].filter(Boolean).join(" · ")}</span></span></button>)}</div>
        )}
      </div>
    </Card>
  );
}
