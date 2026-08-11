import { useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import type {
  EventBundle,
  OrganizerAgendaResponse,
  OrganizerSession,
  PublicSpeaker,
  Room,
  SessionFormat,
  Track,
} from "../../../shared/contracts";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  Field,
  Input,
  PageHeader,
  Select,
  Spinner,
  Textarea,
  cn,
} from "../../components/ui";
import { ApiRequestError, apiClient } from "../../lib/api";
import { formatZonedLocalInput, zonedLocalInputToIso } from "../../../shared/domain/timezone";
import { useAsync } from "../../lib/useAsync";
import { useAdminContext } from "./AdminLayout";

const FORMATS: SessionFormat[] = ["talk", "workshop", "panel", "lightning", "keynote"];

interface AgendaData {
  bundle: EventBundle;
  agenda: OrganizerAgendaResponse;
  speakers: PublicSpeaker[];
}

export function Agenda() {
  const { eventSlug } = useAdminContext();
  const { data, error, loading, reload } = useAsync(async (): Promise<AgendaData> => {
    const [bundle, agenda, speakerResponse] = await Promise.all([
      apiClient.eventBundle(eventSlug),
      apiClient.agenda(eventSlug),
      apiClient.publicSpeakers(eventSlug),
    ]);
    return { bundle, agenda, speakers: speakerResponse.speakers };
  }, [eventSlug]);
  const [agendaOverride, setAgendaOverride] = useState<OrganizerAgendaResponse | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const draggedSessionIdRef = useRef<string | null>(null);
  const [dragOverRoomId, setDragOverRoomId] = useState<string | null>(null);
  const [busyDrop, setBusyDrop] = useState(false);
  const [view, setView] = useState<"board" | "list">("board");
  const [dayFilter, setDayFilter] = useState("all");
  const [trackFilter, setTrackFilter] = useState("all");
  const [roomFilter, setRoomFilter] = useState("all");

  const agenda = agendaOverride ?? data?.agenda;
  const conflictedSessions = useMemo(
    () => new Set(agenda?.conflicts.flatMap((conflict) => conflict.sessionIds) ?? []),
    [agenda?.conflicts],
  );

  async function refreshAgenda() {
    setAgendaOverride(await apiClient.agenda(eventSlug));
  }

  async function dropOnRoom(roomId: string, transferredSessionId?: string) {
    const sessionId = transferredSessionId || draggedSessionIdRef.current;
    if (!agenda || !data || !sessionId || busyDrop) return;
    const session = agenda.sessions.find((candidate) => candidate.id === sessionId);
    if (!session) return;
    const placement = placementForDrop(
      session,
      roomId,
      agenda.sessions,
      dayFilter === "all" ? data.bundle.event.startsOn : dayFilter,
      data.bundle.event.timezone,
    );
    setBusyDrop(true);
    setActionError(null);
    try {
      const next = await apiClient.placeSession(eventSlug, session.id, placement);
      setAgendaOverride(next);
      setNotice(`“${session.title}” moved by drag-and-drop. Conflicts recalculated immediately.`);
    } catch (caught) {
      setActionError(caught instanceof ApiRequestError ? caught.message : "Dragged session could not be placed.");
    } finally {
      setBusyDrop(false);
      draggedSessionIdRef.current = null;
      setDragOverRoomId(null);
    }
  }

  if (loading && !data) return <Spinner label="Loading program" />;
  if (error || !data || !agenda) return <ErrorBanner message={error?.message ?? "Program unavailable."} />;

  const scheduled = agenda.sessions.filter((session) => session.slot !== null);
  const unscheduled = agenda.sessions.filter(
    (session) => session.slot === null && (trackFilter === "all" || session.trackId === trackFilter),
  );
  const visibleScheduled = scheduled.filter((session) => {
    if (trackFilter !== "all" && session.trackId !== trackFilter) return false;
    if (roomFilter !== "all" && session.slot?.roomId !== roomFilter) return false;
    if (
      dayFilter !== "all" &&
      session.slot &&
      dateInTimeZone(session.slot.startsAt, data.bundle.event.timezone) !== dayFilter
    ) return false;
    return true;
  });
  const visibleRooms = data.bundle.rooms.filter((room) => roomFilter === "all" || room.id === roomFilter);
  const eventDays = eventDateRange(data.bundle.event.startsOn, data.bundle.event.endsOn);

  return (
    <div>
      <PageHeader
        title="Agenda"
        subtitle="Build the program from accepted proposals and direct invited sessions. Conflicts update on every move."
        actions={<Button variant="secondary" onClick={() => { setAgendaOverride(null); reload(); }}>Refresh</Button>}
      />

      {notice ? (
        <div role="status" className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {notice}
        </div>
      ) : null}
      {actionError ? <div className="mb-4"><ErrorBanner message={actionError} /></div> : null}

      <DirectSessionForm
        eventSlug={eventSlug}
        tracks={data.bundle.tracks}
        speakers={data.speakers}
        onCreated={async (title) => {
          await refreshAgenda();
          setNotice(`“${title}” was added directly to the program—no submission required.`);
        }}
      />

      <Card className="mb-5 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <p className="text-sm font-semibold text-zinc-900">Agenda projection</p>
            <div className="mt-2 flex gap-1.5" role="group" aria-label="Agenda view">
              <Button type="button" variant={view === "board" ? "primary" : "ghost"} onClick={() => setView("board")}>Room board</Button>
              <Button type="button" variant={view === "list" ? "primary" : "ghost"} onClick={() => setView("list")}>List</Button>
            </div>
          </div>
          <Field label="Day">
            <Select value={dayFilter} onChange={(event) => setDayFilter(event.target.value)}>
              <option value="all">All event days</option>
              {eventDays.map((day, index) => <option key={day} value={day}>Day {index + 1} · {day}</option>)}
            </Select>
          </Field>
          <Field label="Track">
            <Select value={trackFilter} onChange={(event) => setTrackFilter(event.target.value)}>
              <option value="all">All tracks</option>
              {data.bundle.tracks.map((track) => <option key={track.id} value={track.id}>{track.name}</option>)}
            </Select>
          </Field>
          <Field label="Room">
            <Select value={roomFilter} onChange={(event) => setRoomFilter(event.target.value)}>
              <option value="all">All rooms</option>
              {data.bundle.rooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
            </Select>
          </Field>
        </div>
        <p className="mt-3 text-xs leading-5 text-zinc-500">
          Drag any session card onto a room. Scheduled sessions keep their time; unscheduled sessions take the next open 45-minute slot. The Move button remains available for exact time editing and mobile use.
        </p>
      </Card>

      {agenda.conflicts.length > 0 ? (
        <div role="alert">
        <Card className="mb-5 border-rose-300 bg-rose-50 p-4 shadow-none">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-rose-900">
              {agenda.conflicts.length} live schedule {agenda.conflicts.length === 1 ? "conflict" : "conflicts"}
            </p>
            <Badge tone="rose">Needs attention</Badge>
          </div>
          <ul className="mt-2 space-y-1 text-sm text-rose-800">
            {agenda.conflicts.map((conflict) => (
              <li key={`${conflict.type}-${conflict.slotIds.join("-")}`}>
                {describeConflict(conflict, agenda.sessions, data.bundle.rooms)}
              </li>
            ))}
          </ul>
        </Card>
        </div>
      ) : (
        <div className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          No room or speaker conflicts.
        </div>
      )}

      {agenda.sessions.length === 0 ? (
        <EmptyState title="No sessions yet" body="Approve a proposal or add an invited session above." />
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(18rem,0.7fr)_minmax(0,2fr)]">
          <section>
            <SectionTitle title="Unscheduled" count={unscheduled.length} />
            <div className="space-y-3">
              {unscheduled.length === 0 ? (
                <EmptyState title="Everything is placed" body="All sessions have a day, time, and room." />
              ) : (
                unscheduled.map((session) => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    rooms={data.bundle.rooms}
                    eventDate={data.bundle.event.startsOn}
                    timezone={data.bundle.event.timezone}
                    conflicted={false}
                    onPlaced={setAgendaOverride}
                    eventSlug={eventSlug}
                    draggable
                    onDragStart={() => { draggedSessionIdRef.current = session.id; }}
                    onDragEnd={() => { draggedSessionIdRef.current = null; setDragOverRoomId(null); }}
                  />
                ))
              )}
            </div>
          </section>

          <section>
            <SectionTitle title={view === "board" ? "By room" : "Agenda list"} count={visibleScheduled.length} />
            {view === "board" ? <div className="grid gap-4 lg:grid-cols-2">
              {visibleRooms.map((room) => {
                const roomSessions = visibleScheduled
                  .filter((session) => session.slot?.roomId === room.id)
                  .sort((a, b) => (a.slot?.startsAt ?? "").localeCompare(b.slot?.startsAt ?? ""));
                return (
                  <Card
                    key={room.id}
                    className={cn("overflow-hidden transition-colors", dragOverRoomId === room.id && "border-accent bg-accent-soft")}
                    role="region"
                    aria-label={`${room.name} session drop zone`}
                    onDragOver={(event) => { event.preventDefault(); setDragOverRoomId(room.id); }}
                    onDragLeave={() => setDragOverRoomId((current) => current === room.id ? null : current)}
                    onDrop={(event) => {
                      event.preventDefault();
                      void dropOnRoom(
                        room.id,
                        event.dataTransfer.getData("application/x-speakerops-session") ||
                          event.dataTransfer.getData("text/plain"),
                      );
                    }}
                  >
                    <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-3">
                      <p className="font-semibold text-zinc-900">{room.name}</p>
                      <p className="text-xs text-zinc-500">
                        {roomSessions.length} {roomSessions.length === 1 ? "session" : "sessions"}
                      </p>
                    </div>
                    <div className="space-y-3 p-3">
                      {roomSessions.length === 0 ? (
                        <p className="py-6 text-center text-sm text-zinc-400">No sessions placed</p>
                      ) : (
                        roomSessions.map((session) => (
                          <SessionCard
                            key={session.id}
                            session={session}
                            rooms={data.bundle.rooms}
                            eventDate={data.bundle.event.startsOn}
                            timezone={data.bundle.event.timezone}
                            conflicted={conflictedSessions.has(session.id)}
                            onPlaced={setAgendaOverride}
                            eventSlug={eventSlug}
                            draggable
                            onDragStart={() => { draggedSessionIdRef.current = session.id; }}
                            onDragEnd={() => { draggedSessionIdRef.current = null; setDragOverRoomId(null); }}
                          />
                        ))
                      )}
                    </div>
                  </Card>
                );
              })}
            </div> : (
              <div className="space-y-3">
                {visibleScheduled.length === 0 ? (
                  <EmptyState title="No sessions match these filters" body="Change the day, track, or room filter." />
                ) : visibleScheduled
                  .sort((a, b) => (a.slot?.startsAt ?? "").localeCompare(b.slot?.startsAt ?? ""))
                  .map((session) => (
                    <SessionCard
                      key={session.id}
                      session={session}
                      rooms={data.bundle.rooms}
                      eventDate={data.bundle.event.startsOn}
                      timezone={data.bundle.event.timezone}
                      conflicted={conflictedSessions.has(session.id)}
                      onPlaced={setAgendaOverride}
                      eventSlug={eventSlug}
                      draggable
                      onDragStart={() => { draggedSessionIdRef.current = session.id; }}
                      onDragEnd={() => { draggedSessionIdRef.current = null; setDragOverRoomId(null); }}
                    />
                  ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function DirectSessionForm({
  eventSlug,
  tracks,
  speakers,
  onCreated,
}: {
  eventSlug: string;
  tracks: Track[];
  speakers: PublicSpeaker[];
  onCreated: (title: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [abstract, setAbstract] = useState("");
  const [format, setFormat] = useState<SessionFormat>("keynote");
  const [trackId, setTrackId] = useState("");
  const [speakerId, setSpeakerId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiClient.createDirectSession(eventSlug, {
        title,
        abstract,
        format,
        trackId: trackId || null,
        speakerIds: speakerId ? [speakerId] : [],
      });
      await onCreated(title);
      setTitle("");
      setAbstract("");
      setSpeakerId("");
      setOpen(false);
    } catch (caught) {
      setError(caught instanceof ApiRequestError ? caught.message : "Session could not be added.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="mb-5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold text-zinc-900">Sponsor or invited session</p>
          <p className="mt-0.5 text-sm text-zinc-500">Add it straight to the program without manufacturing a CFP submission.</p>
        </div>
        <Button type="button" variant={open ? "ghost" : "primary"} onClick={() => setOpen((value) => !value)}>
          {open ? "Cancel" : "Add direct session"}
        </Button>
      </div>
      {open ? (
        <form onSubmit={submit} className="mt-5 grid gap-4 border-t border-zinc-100 pt-5 md:grid-cols-2">
          <Field label="Session title" required>
            <Input value={title} onChange={(event) => setTitle(event.target.value)} minLength={3} required />
          </Field>
          <Field label="Format" required>
            <Select value={format} onChange={(event) => setFormat(event.target.value as SessionFormat)}>
              {FORMATS.map((value) => <option key={value} value={value}>{value}</option>)}
            </Select>
          </Field>
          <Field label="Track">
            <Select value={trackId} onChange={(event) => setTrackId(event.target.value)}>
              <option value="">No track</option>
              {tracks.map((track) => <option key={track.id} value={track.id}>{track.name}</option>)}
            </Select>
          </Field>
          <Field label="Speaker">
            <Select value={speakerId} onChange={(event) => setSpeakerId(event.target.value)}>
              <option value="">Assign later</option>
              {speakers.map((speaker) => <option key={speaker.id} value={speaker.id}>{speaker.name}</option>)}
            </Select>
          </Field>
          <div className="md:col-span-2">
            <Field label="Description" required>
              <Textarea value={abstract} onChange={(event) => setAbstract(event.target.value)} minLength={10} required />
            </Field>
          </div>
          {error ? <div className="md:col-span-2"><ErrorBanner message={error} /></div> : null}
          <div className="md:col-span-2">
            <Button type="submit" disabled={saving}>{saving ? "Adding…" : "Add to program"}</Button>
          </div>
        </form>
      ) : null}
    </Card>
  );
}

function SessionCard({
  session,
  rooms,
  eventDate,
  timezone,
  conflicted,
  eventSlug,
  onPlaced,
  draggable,
  onDragStart,
  onDragEnd,
}: {
  session: OrganizerSession;
  rooms: Room[];
  eventDate: string;
  timezone: string;
  conflicted: boolean;
  eventSlug: string;
  onPlaced: (agenda: OrganizerAgendaResponse) => void;
  draggable?: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}) {
  const [editing, setEditing] = useState(session.slot === null);
  const [roomId, setRoomId] = useState(session.slot?.roomId ?? rooms[0]?.id ?? "");
  const [startsAt, setStartsAt] = useState(
    session.slot ? formatZonedLocalInput(session.slot.startsAt, timezone) : `${eventDate}T09:00`,
  );
  const [endsAt, setEndsAt] = useState(
    session.slot ? formatZonedLocalInput(session.slot.endsAt, timezone) : `${eventDate}T09:45`,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const speakers = session.speakers.map((speaker) => speaker.name).join(", ");

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const agenda = await apiClient.placeSession(eventSlug, session.id, {
        roomId,
        startsAt: zonedLocalInputToIso(startsAt, timezone),
        endsAt: zonedLocalInputToIso(endsAt, timezone),
      });
      onPlaced(agenda);
      setEditing(false);
    } catch (caught) {
      setError(caught instanceof ApiRequestError ? caught.message : "Placement could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <article
      className={cn(
        "rounded-lg border bg-white p-3",
        conflicted ? "border-rose-400 ring-2 ring-rose-100" : "border-zinc-200",
        draggable && "cursor-grab active:cursor-grabbing",
      )}
      draggable={draggable}
      aria-label={draggable ? `${session.title}, draggable session` : undefined}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("application/x-speakerops-session", session.id);
        event.dataTransfer.setData("text/plain", session.id);
        onDragStart?.();
      }}
      onDragEnd={onDragEnd}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium leading-snug text-zinc-900">{session.title}</p>
          <p className="mt-1 truncate text-xs text-zinc-500">{speakers || "Speaker TBA"}</p>
        </div>
        <Badge tone={session.origin === "direct" ? "violet" : "sky"}>{session.origin === "direct" ? "Direct" : "CFP"}</Badge>
      </div>
      {session.slot ? (
        <p className={cn("mt-2 text-xs font-medium", conflicted ? "text-rose-700" : "text-zinc-600")}>
          {formatSlot(session.slot.startsAt, session.slot.endsAt, timezone)}
        </p>
      ) : null}
      {editing ? (
        <div className="mt-3 space-y-2 border-t border-zinc-100 pt-3">
          <Select aria-label={`Room for ${session.title}`} value={roomId} onChange={(event) => setRoomId(event.target.value)}>
            {rooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
          </Select>
          <div className="grid grid-cols-2 gap-2">
            <Input aria-label={`Start for ${session.title}`} type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} />
            <Input aria-label={`End for ${session.title}`} type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} />
          </div>
          <p className="text-[11px] text-zinc-400">Times use the event timezone: {timezone}.</p>
          {error ? <ErrorBanner message={error} /> : null}
          <div className="flex gap-2">
            <Button type="button" className="flex-1" disabled={saving || !roomId} onClick={() => void save()}>{saving ? "Saving…" : "Save placement"}</Button>
            {session.slot ? <Button type="button" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button> : null}
          </div>
        </div>
      ) : (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button type="button" variant="ghost" className="px-2 py-1 text-xs" onClick={() => setEditing(true)}>Move session</Button>
          {session.slot && session.speakers.length > 0 ? (
            <Link
              to={`/admin/communications?session=${encodeURIComponent(session.id)}`}
              className="text-xs font-medium text-accent hover:underline"
            >
              Notify speakers →
            </Link>
          ) : null}
        </div>
      )}
    </article>
  );
}

function SectionTitle({ title, count }: { title: string; count: number }) {
  return <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-semibold text-zinc-900">{title}</h2><Badge>{count}</Badge></div>;
}

function formatSlot(startsAt: string, endsAt: string, timezone: string): string {
  const date = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: timezone }).format(new Date(startsAt));
  const time = new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit", timeZone: timezone });
  return `${date} · ${time.format(new Date(startsAt))}–${time.format(new Date(endsAt))}`;
}

export function dateInTimeZone(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: timezone,
  }).format(new Date(iso));
}

export function eventDateRange(startsOn: string, endsOn: string): string[] {
  const days: string[] = [];
  const cursor = new Date(`${startsOn}T12:00:00Z`);
  const end = new Date(`${endsOn}T12:00:00Z`);
  while (cursor <= end && days.length < 31) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

export function placementForDrop(
  session: OrganizerSession,
  roomId: string,
  sessions: OrganizerSession[],
  day: string,
  timezone: string,
): { roomId: string; startsAt: string; endsAt: string } {
  if (session.slot) {
    return { roomId, startsAt: session.slot.startsAt, endsAt: session.slot.endsAt };
  }
  const defaultStart = zonedLocalInputToIso(`${day}T09:00`, timezone);
  const roomEnds = sessions
    .filter(
      (candidate) =>
        candidate.slot?.roomId === roomId &&
        candidate.slot !== null &&
        dateInTimeZone(candidate.slot.startsAt, timezone) === day,
    )
    .map((candidate) => candidate.slot!.endsAt)
    .sort();
  const startsAt = roomEnds.at(-1) ?? defaultStart;
  const endsAt = new Date(Date.parse(startsAt) + 45 * 60 * 1000).toISOString();
  return { roomId, startsAt, endsAt };
}

function describeConflict(
  conflict: OrganizerAgendaResponse["conflicts"][number],
  sessions: OrganizerSession[],
  rooms: Room[],
): string {
  const title = (id: string) => sessions.find((session) => session.id === id)?.title ?? id;
  if (conflict.type === "room") {
    const room = rooms.find((candidate) => candidate.id === conflict.roomId)?.name ?? "a room";
    return `Room conflict in ${room}: “${title(conflict.sessionIds[0])}” overlaps “${title(conflict.sessionIds[1])}”.`;
  }
  const speaker = sessions.flatMap((session) => session.speakers).find((candidate) => candidate.id === conflict.speakerId)?.name ?? "A speaker";
  return `Speaker conflict: ${speaker} is booked for “${title(conflict.sessionIds[0])}” and “${title(conflict.sessionIds[1])}” at the same time.`;
}
