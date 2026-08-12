import { describe, expect, it } from "vitest";
import { personalizeSpeakerMessage } from "./communications";

describe("personalizeSpeakerMessage", () => {
  it("renders every documented portal-invitation token for one recipient", () => {
    expect(personalizeSpeakerMessage(
      "Hi {{speaker_name}} — open {{event_name}} at {{portal_link}}. Again: {{portal_link}}",
      { speakerName: "Ada", eventName: "Groundwork", portalUrl: "https://lectern.test/speaker/spk_ada" },
    )).toBe("Hi Ada — open Groundwork at https://lectern.test/speaker/spk_ada. Again: https://lectern.test/speaker/spk_ada");
  });

  it("leaves unknown tokens visible", () => {
    expect(personalizeSpeakerMessage("{{speaker_company}}", {
      speakerName: "Ada", eventName: "Groundwork", portalUrl: "https://lectern.test/speaker/spk_ada",
    })).toBe("{{speaker_company}}");
  });
});
