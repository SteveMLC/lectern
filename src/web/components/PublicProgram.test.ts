import { describe, expect, it } from "vitest";
import type { PublicScheduleResponse, PublicSession, PublicSpeaker } from "../../shared/contracts";
import { filterPublicSessions, sortSpeakersBySurname } from "./PublicProgram";

const speaker = (id: string, name: string) => ({ id, name, company: null, title: null, role: "primary" as const, sortOrder: 0 });
const session = (id: string, title: string, speakerName: string, trackId: string, format: PublicSession["format"]): PublicSession => ({
  id, title, abstract: "A complete public session description.", format,
  status: "confirmed", origin: "direct",
  track: { id: trackId, name: trackId, color: null },
  speakers: [speaker(`spk_${id}`, speakerName)],
});

const sessions = [
  session("agents", "Reliable Agents", "Ada Okafor", "ai", "talk"),
  session("platform", "Platform Clinic", "Lin Zhao", "infra", "workshop"),
];

const schedule: PublicScheduleResponse = {
  event: { id: "evt", slug: "event", name: "Event", tagline: null, startsOn: "2026-10-14", endsOn: "2026-10-15", timezone: "UTC" },
  timezone: "UTC",
  slots: sessions.map((item, index) => ({
    id: `slot_${item.id}`, startsAt: `2026-10-14T${index ? "11" : "09"}:00:00Z`, endsAt: `2026-10-14T${index ? "12" : "10"}:00:00Z`,
    room: { id: index ? "studio" : "hall", name: index ? "Studio" : "Hall" }, session: item,
  })),
};

describe("filterPublicSessions", () => {
  it("searches both titles and speaker names", () => {
    expect(filterPublicSessions(sessions, schedule, { query: "ada", trackId: "", format: "", roomId: "" }).map((item) => item.id)).toEqual(["agents"]);
    expect(filterPublicSessions(sessions, schedule, { query: "clinic", trackId: "", format: "", roomId: "" }).map((item) => item.id)).toEqual(["platform"]);
  });

  it("combines track, format, and room facets", () => {
    expect(filterPublicSessions(sessions, schedule, { query: "", trackId: "infra", format: "workshop", roomId: "studio" }).map((item) => item.id)).toEqual(["platform"]);
    expect(filterPublicSessions(sessions, schedule, { query: "", trackId: "ai", format: "workshop", roomId: "" })).toEqual([]);
  });
});

describe("sortSpeakersBySurname", () => {
  it("sorts the directory by surname without mutating input", () => {
    const input: PublicSpeaker[] = [
      { id: "1", name: "Lin Zhao", company: null, title: null, bio: null, location: null, socials: null, headshotUrl: null },
      { id: "2", name: "Ada Okafor", company: null, title: null, bio: null, location: null, socials: null, headshotUrl: null },
    ];
    expect(sortSpeakersBySurname(input).map((item) => item.name)).toEqual(["Ada Okafor", "Lin Zhao"]);
    expect(input[0]?.name).toBe("Lin Zhao");
  });
});
