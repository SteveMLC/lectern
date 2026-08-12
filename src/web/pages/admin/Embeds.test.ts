import { describe, expect, it } from "vitest";
import { embedCode } from "./Embeds";

const base = {
  name: "AI track sessions",
  widget: "sessions" as const,
  color: "#112233",
  track: "trk_ai",
  showDescription: false,
  showCompany: true,
};

describe("embedCode", () => {
  it("generates a configured styled iframe", () => {
    const code = embedCode("https://lectern.example", "horizon-2026", { ...base, format: "styled_html" });
    expect(code).toContain("/api/embeds/events/horizon-2026/sessions?");
    expect(code).toContain("track=trk_ai");
    expect(code).toContain("description=0");
    expect(code).toContain("border:1px solid #112233");
  });

  it("generates JSON, XML, and whole-agenda iCal feeds", () => {
    expect(embedCode("https://lectern.example", "horizon-2026", { ...base, format: "json" })).toContain("/api/public/events/horizon-2026/sessions?");
    expect(embedCode("https://lectern.example", "horizon-2026", { ...base, format: "xml" })).toContain("/api/public/events/horizon-2026/sessions.xml?");
    expect(embedCode("https://lectern.example", "horizon-2026", { ...base, format: "ical" })).toContain("/api/public/events/horizon-2026/agenda.ics?");
  });
});
