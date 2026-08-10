import { describe, expect, it } from "vitest";
import {
  deterministicDraft,
  draftDecisionFeedback,
  type FeedbackDraftInput,
} from "./decisionFeedback";

const INPUT: FeedbackDraftInput = {
  eventName: "Horizon Dev Summit 2026",
  speakerName: "Tobias Lindqvist",
  talkTitle: "Microservices Were a Mistake",
  talkAbstract: "A polemic against service decomposition, drawn from one migration at one company.",
  decision: "deny",
  reasoning: "we ran a nearly identical talk last year; single data point; abstract has no numbers",
};

function fakeAnthropic(responder: () => { status?: number; body?: unknown }) {
  const calls: { url: string; body: Record<string, unknown> }[] = [];
  const fetcher = (async (url: string | URL, init?: RequestInit) => {
    calls.push({ url: String(url), body: JSON.parse(String(init?.body)) });
    const { status = 200, body = {} } = responder();
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
  return { fetcher, calls };
}

describe("deterministicDraft", () => {
  it("carries the organizer's reasons as bullets and states the decision plainly", () => {
    const draft = deterministicDraft(INPUT);
    expect(draft.aiUsed).toBe(false);
    expect(draft.subject).toContain("Microservices Were a Mistake");
    expect(draft.bodyMd).toContain("not able to include it");
    expect(draft.bodyMd).toContain("- we ran a nearly identical talk last year");
    expect(draft.bodyMd).toContain("- abstract has no numbers");
    expect(draft.bodyMd).toContain("future event");
  });

  it("waitlist wording is a genuine hold, not a soft rejection", () => {
    const draft = deterministicDraft({ ...INPUT, decision: "maybe" });
    expect(draft.subject).toContain("waitlisted");
    expect(draft.bodyMd).toContain("waitlist");
    expect(draft.bodyMd).toContain("No action is needed");
  });

  it("omits the feedback section when no reasoning is given", () => {
    const draft = deterministicDraft({ ...INPUT, reasoning: "" });
    expect(draft.bodyMd).not.toContain("Feedback from the committee");
  });
});

describe("draftDecisionFeedback", () => {
  it("uses the deterministic template when no key is configured", async () => {
    const draft = await draftDecisionFeedback(INPUT, {});
    expect(draft.aiUsed).toBe(false);
    expect(draft.note).toContain("ANTHROPIC_API_KEY");
  });

  it("returns the AI draft from a forced tool_use response", async () => {
    const { fetcher, calls } = fakeAnthropic(() => ({
      body: {
        content: [
          {
            type: "tool_use",
            input: {
              subject: "Your Horizon proposal",
              body: "Hi Tobias,\n\nThank you for proposing…",
            },
          },
        ],
      },
    }));

    const draft = await draftDecisionFeedback(INPUT, { apiKey: "sk-ant-test", fetcher });
    expect(draft.aiUsed).toBe(true);
    expect(draft.subject).toBe("Your Horizon proposal");
    expect(draft.model).toBe("claude-sonnet-5");

    // The request carried the organizer's reasoning and forced the tool.
    const sent = calls[0]!.body;
    expect(JSON.stringify(sent.messages)).toContain("nearly identical talk last year");
    expect(sent.tool_choice).toEqual({ type: "tool", name: "email_draft" });
    expect(sent.model).toBe("claude-sonnet-5");
  });

  it("falls back to the template when the API errors, with a note", async () => {
    const { fetcher } = fakeAnthropic(() => ({ status: 529, body: { error: "overloaded" } }));
    const draft = await draftDecisionFeedback(INPUT, { apiKey: "sk-ant-test", fetcher });
    expect(draft.aiUsed).toBe(false);
    expect(draft.note).toContain("AI drafting unavailable");
    expect(draft.bodyMd).toContain("- single data point");
  });

  it("falls back when the response has no usable draft", async () => {
    const { fetcher } = fakeAnthropic(() => ({ body: { content: [{ type: "text" }] } }));
    const draft = await draftDecisionFeedback(INPUT, { apiKey: "sk-ant-test", fetcher });
    expect(draft.aiUsed).toBe(false);
    expect(draft.subject).toContain("Microservices");
  });

  it("honors a model override", async () => {
    const { fetcher, calls } = fakeAnthropic(() => ({
      body: { content: [{ type: "tool_use", input: { subject: "S", body: "B" } }] },
    }));
    await draftDecisionFeedback(INPUT, { apiKey: "k", model: "claude-fable-5", fetcher });
    expect(calls[0]!.body.model).toBe("claude-fable-5");
  });
});
