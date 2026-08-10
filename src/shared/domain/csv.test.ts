import { describe, expect, it } from "vitest";
import type { SubmissionListItem } from "../contracts";
import { submissionsToCsv, toCsv } from "./csv";

describe("toCsv", () => {
  it("quotes fields containing commas, quotes, and newlines", () => {
    const csv = toCsv([
      ["plain", "with, comma", 'say "hi"', "line\nbreak"],
    ]);
    expect(csv).toBe('plain,"with, comma","say ""hi""","line\nbreak"\r\n');
  });

  it("leaves clean fields unquoted", () => {
    expect(toCsv([["a", "b", "c"]])).toBe("a,b,c\r\n");
  });

  it("neutralizes spreadsheet formulas in user-controlled cells", () => {
    expect(toCsv([["=WEBSERVICE(\"https://example.invalid\")", "+1+1", " @SUM(A1:A2)", "-2+3"]]))
      .toBe('"\'=WEBSERVICE(""https://example.invalid"")",\'+1+1,\' @SUM(A1:A2),\'-2+3\r\n');
  });
});

describe("submissionsToCsv", () => {
  const submission: SubmissionListItem = {
    id: "sub_1",
    eventId: "evt_1",
    formId: null,
    trackId: null,
    title: 'Shipping "Fast", Safely',
    abstract: "Line one.\nLine two.",
    format: "talk",
    status: "under_review",
    answers: {},
    submittedAt: "2026-07-29T19:00:00Z",
    createdAt: "2026-07-29T19:00:00Z",
    updatedAt: "2026-07-29T19:00:00Z",
    trackName: "Product & Design",
    speakers: [
      {
        speakerId: "spk_a",
        role: "primary",
        sortOrder: 0,
        name: "Tom Ostrander",
        email: "tom@plainsignal.example",
        company: "PlainSignal",
        bio: null,
      },
      {
        speakerId: "spk_b",
        role: "co_speaker",
        sortOrder: 1,
        name: "Ada Okafor",
        email: "ada@nimbuslabs.example",
        company: null,
        bio: null,
      },
    ],
  };

  it("produces a header plus one row per submission with speakers flattened", () => {
    const csv = submissionsToCsv([submission]);
    const lines = csv.trimEnd().split("\r\n");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain("Title,Status,Track");
    expect(lines[1]).toContain('"Shipping ""Fast"", Safely"');
    expect(lines[1]).toContain("Tom Ostrander; Ada Okafor");
    expect(lines[1]).toContain("tom@plainsignal.example; ada@nimbuslabs.example");
    expect(lines[1]).toContain("PlainSignal");
    expect(lines[1]).toContain('"Line one.\nLine two."');
  });

  it("handles an empty list as just the header", () => {
    expect(submissionsToCsv([]).trimEnd().split("\r\n")).toHaveLength(1);
  });
});
