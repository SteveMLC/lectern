import { useEffect, useMemo, useState } from "react";
import type { PublicScheduleResponse } from "../../shared/contracts";
import { Button, Card, EmptyState } from "./ui";
import { formatDateTime } from "../lib/status";

export function Itinerary({ schedule }: { schedule: PublicScheduleResponse }) {
  const storageKey = `speakerops.itinerary.${schedule.event.slug}`;
  const [saved, setSaved] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(storageKey) ?? "[]") as string[]; } catch { return []; }
  });
  const days = useMemo(() => [...new Set(schedule.slots.map((slot) => slot.startsAt.slice(0, 10)))], [schedule.slots]);
  const [day, setDay] = useState(days[0] ?? "all");
  useEffect(() => { localStorage.setItem(storageKey, JSON.stringify(saved)); }, [saved, storageKey]);
  const visible = schedule.slots.filter((slot) => day === "all" || slot.startsAt.startsWith(day));
  const savedSlots = schedule.slots.filter((slot) => saved.includes(slot.session.id));
  function toggle(id: string) { setSaved((ids) => ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]); }
  return <Card className="p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-base font-semibold text-zinc-900">My itinerary</h2><p className="mt-1 text-sm text-zinc-500">Anonymous and stored only in this browser · {savedSlots.length} saved</p></div>{saved.length > 0 ? <Button variant="ghost" onClick={() => setSaved([])}>Clear all</Button> : null}</div><div className="mt-4 flex flex-wrap gap-2"><Button className="px-3 py-1.5 text-xs" variant={day === "all" ? "primary" : "secondary"} onClick={() => setDay("all")}>All days</Button>{days.map((value, index) => <Button key={value} className="px-3 py-1.5 text-xs" variant={day === value ? "primary" : "secondary"} onClick={() => setDay(value)}>Day {index + 1}</Button>)}</div>{visible.length === 0 ? <EmptyState title="Schedule coming soon" /> : <div className="mt-4 divide-y divide-zinc-100">{visible.map((slot) => { const selected = saved.includes(slot.session.id); return <article key={slot.id} className="flex items-start justify-between gap-4 py-3"><div><p className="text-sm font-semibold text-zinc-900">{slot.session.title}</p><p className="mt-1 text-xs text-zinc-500">{formatDateTime(slot.startsAt, schedule.timezone)} · {slot.room?.name ?? "Room pending"}{slot.session.speakers.length ? ` · ${slot.session.speakers.map((speaker) => speaker.name).join(", ")}` : ""}</p></div><button type="button" aria-pressed={selected} aria-label={`${selected ? "Remove" : "Save"} ${slot.session.title} ${selected ? "from" : "to"} my itinerary`} onClick={() => toggle(slot.session.id)} className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium ${selected ? "border-amber-300 bg-amber-50 text-amber-800" : "border-zinc-200 bg-white text-zinc-600"}`}>{selected ? "★ Saved" : "☆ Save"}</button></article>; })}</div>}</Card>;
}
