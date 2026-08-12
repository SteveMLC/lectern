import { describe, expect, it } from "vitest";
import type {
  PublicScheduleResponse,
  PublicSessionsResponse,
  PublicSpeakersResponse,
} from "../../shared/contracts";
import {
  renderItineraryEmbed,
  renderScheduleEmbed,
  renderSessionsEmbed,
  renderSpeakersEmbed,
} from "./api";

const event = {
  id: "evt_test",
  slug: "test-summit",
  name: "Test Summit",
  tagline: "A real conference",
  startsOn: "2026-10-14",
  endsOn: "2026-10-15",
  timezone: "America/Los_Angeles",
};

const ada = {
  id: "spk_ada",
  name: "Ada Okafor",
  company: "Nimbus Labs",
  title: "Principal Engineer",
  role: "primary" as const,
  sortOrder: 0,
};

const session = {
  id: "ses_agents",
  title: "Agents in Production",
  abstract: "A detailed account of production agent failures and the safeguards that fixed them.",
  format: "talk" as const,
  status: "confirmed" as const,
  origin: "direct" as const,
  track: { id: "trk_ai", name: "AI Engineering", color: "#c7d2fe" },
  speakers: [ada],
};

const dayTwoSession = {
  ...session,
  id: "ses_clinic",
  title: "Day Two Reliability Clinic",
  format: "workshop" as const,
};

const schedule: PublicScheduleResponse = {
  event,
  timezone: event.timezone,
  slots: [
    {
      id: "slot_agents",
      startsAt: "2026-10-14T17:00:00Z",
      endsAt: "2026-10-14T17:45:00Z",
      room: { id: "room_main", name: "Main Hall" },
      session,
    },
    {
      id: "slot_clinic",
      startsAt: "2026-10-15T17:00:00Z",
      endsAt: "2026-10-15T18:30:00Z",
      room: { id: "room_studio", name: "Workshop Studio" },
      session: dayTwoSession,
    },
  ],
};

const sessions: PublicSessionsResponse = { event, sessions: [session, dayTwoSession] };
const speakers: PublicSpeakersResponse = {
  event,
  speakers: [
    {
      id: ada.id,
      name: ada.name,
      company: ada.company,
      title: ada.title,
      bio: "Ada builds reliable agent infrastructure.",
      location: "Lagos / Remote",
      socials: null,
      headshotUrl: "/api/assets/ada",
    },
  ],
};

describe("public conference embeds", () => {
  it("renders two navigable agenda days with expandable complete session details", async () => {
    const html = await renderScheduleEmbed(schedule).text();

    expect(html).toContain('data-day-button="Wednesday, October 14"');
    expect(html).toContain('data-day-button="Thursday, October 15"');
    expect(html).toContain('data-day-panel="Thursday, October 15" hidden');
    expect(html).toContain("Workshop Studio");
    expect(html).toContain("10:00 AM-11:30 AM");
    expect(html).toContain("AI Engineering");
    expect(html).toContain("Ada Okafor");
    expect(html).toContain("<details");
  });

  it("renders searchable sessions with track, format, room, speaker, and schedule facets", async () => {
    const html = await renderSessionsEmbed(sessions, schedule).text();

    expect(html).toContain('aria-label="Search sessions"');
    expect(html).toContain('aria-label="Filter by track"');
    expect(html).toContain('aria-label="Filter by format"');
    expect(html).toContain('aria-label="Filter by room"');
    expect(html).toContain('data-search="agents in production ada okafor principal engineer nimbus labs"');
    expect(html).toContain('data-room="Main Hall"');
    expect(html).toContain("Wednesday, October 14 · 10:00 AM-10:45 AM");
  });

  it("renders a distinct searchable gallery with bios and scheduled-session details", async () => {
    const html = await renderSpeakersEmbed(speakers, schedule, true).text();

    expect(html).toContain("Speaker gallery");
    expect(html).toContain('<section class="gallery">');
    expect(html).toContain('aria-label="Search speakers"');
    expect(html).toContain("Ada builds reliable agent infrastructure.");
    expect(html).toContain("Agents in Production");
    expect(html).toContain("Main Hall");
  });

  it("renders an anonymous browser-local itinerary with exact selection and ICS controls", async () => {
    const html = await renderItineraryEmbed(schedule).text();

    expect(html).toContain('data-itinerary="test-summit"');
    expect(html).toContain('data-save-id="ses_agents"');
    expect(html).toContain("My saved schedule only");
    expect(html).toContain("Export saved .ics");
    expect(html).toContain("localStorage.setItem");
    expect(html).toContain("sessions='+encodeURIComponent(saved.join(','))");
  });
});
