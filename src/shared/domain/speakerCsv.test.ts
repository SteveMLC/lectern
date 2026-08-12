import { describe, expect, it } from "vitest";
import { parseSpeakerCsv } from "./speakerCsv";

describe("speaker CSV import", () => {
  it("maps common headers and quoted commas", () => {
    expect(parseSpeakerCsv('Name,Email,Bio,Company,Role\n"Dana Whitfield",dana@example.com,"Builder, operator",Aurora,CTO'))
      .toEqual([{ name: "Dana Whitfield", email: "dana@example.com", bio: "Builder, operator", company: "Aurora", title: "CTO" }]);
  });

  it("rejects missing headers and duplicate emails", () => {
    expect(() => parseSpeakerCsv("Person,Email\nAda,ada@example.com")).toThrow("Name and Email");
    expect(() => parseSpeakerCsv("Name,Email\nAda,ada@example.com\nAda 2,ada@example.com")).toThrow("duplicates");
  });
});
