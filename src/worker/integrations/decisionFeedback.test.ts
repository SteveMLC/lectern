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

const APPROVE_INPUT: FeedbackDraftInput = {
  ...INPUT,
  decision: "approve",
  reasoning: "loved the contrarian take — main stage material",
  portalUrl: "https://speakerops.example/speaker/spk_tob",
  onboardingTasks: ["Upload your headshot", "Confirm your bio", "Upload draft slides", "Book your AV check"],
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
  it("states the decision plainly without leaking blunt internal reasoning", () => {
    const draft = deterministicDraft(INPUT);
    expect(draft.aiUsed).toBe(false);
    expect(draft.subject).toContain("Microservices Were a Mistake");
    expect(draft.bodyMd).toContain("not able to include it");
    expect(draft.bodyMd).not.toContain("we ran a nearly identical talk last year");
    expect(draft.bodyMd).not.toContain("abstract has no numbers");
    expect(draft.bodyMd).toContain("future event");
    expect(draft.note).toContain("internal reasoning was not copied");
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

  it("acceptance carries congratulations, the portal link, and the exact checklist", () => {
    const draft = deterministicDraft({ ...APPROVE_INPUT });
    expect(draft.subject).toContain("You're speaking at");
    expect(draft.bodyMd).toContain("is accepted");
    expect(draft.bodyMd).toContain("https://speakerops.example/speaker/spk_tob");
    expect(draft.bodyMd).toContain("- Upload your headshot");
    expect(draft.bodyMd).toContain("- Confirm your bio");
    // Internal note stays internal even on a happy decision.
    expect(draft.bodyMd).not.toContain("main stage material");
    // No invented logistics.
    expect(draft.bodyMd).toContain("once the schedule is locked");
  });

  it("acceptance without task definitions still reads complete", () => {
    const draft = deterministicDraft({ ...APPROVE_INPUT, onboardingTasks: [] });
    expect(draft.bodyMd).toContain("https://speakerops.example/speaker/spk_tob");
    // No empty bullet-list block when the event defines no onboarding tasks.
    expect(draft.bodyMd).not.toMatch(/^- /m);
  });
});

describe("draftDecisionFeedback", () => {
  it("uses the deterministic template when no key is configured", async () => {
    const draft = await draftDecisionFeedback(INPUT, {});
    expect(draft.aiUsed).toBe(false);
    expect(draft.note).toContain("internal reasoning was not copied");
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
        id: "msg_runtime_1",
        model: "claude-sonnet-5",
        usage: { input_tokens: 120, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 80 },
      },
    }));

    const draft = await draftDecisionFeedback(INPUT, { apiKey: "sk-ant-test", fetcher });
    expect(draft.aiUsed).toBe(true);
    expect(draft.subject).toBe("Your Horizon proposal");
    expect(draft.model).toBe("claude-sonnet-5");
    expect(draft.providerEvidence).toEqual({
      requestId: "msg_runtime_1",
      model: "claude-sonnet-5",
      usage: {
        inputTokens: 120,
        cacheCreationInputTokens: 0,
        cacheCreation5mInputTokens: 0,
        cacheCreation1hInputTokens: 0,
        cacheReadInputTokens: 0,
        outputTokens: 80,
      },
    });

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
    expect(draft.bodyMd).not.toContain("single data point");
  });

  it("falls back when the response has no usable draft", async () => {
    const { fetcher } = fakeAnthropic(() => ({
      body: {
        id: "msg_fallback",
        model: "claude-sonnet-5",
        usage: { input_tokens: 11, output_tokens: 2 },
        content: [{ type: "text" }],
      },
    }));
    const draft = await draftDecisionFeedback(INPUT, { apiKey: "sk-ant-test", fetcher });
    expect(draft.aiUsed).toBe(false);
    expect(draft.subject).toContain("Microservices");
    expect(draft.providerEvidence?.requestId).toBe("msg_fallback");
  });

  it("guarantees the portal link on acceptances even when the AI omits it", async () => {
    const { fetcher } = fakeAnthropic(() => ({
      body: {
        id: "msg_no_link",
        model: "claude-sonnet-5",
        usage: { input_tokens: 50, output_tokens: 40 },
        content: [
          {
            type: "tool_use",
            input: { subject: "Welcome aboard!", body: "Hi Tobias,\n\nYou're in. Details soon." },
          },
        ],
      },
    }));
    const draft = await draftDecisionFeedback(APPROVE_INPUT, { apiKey: "k", fetcher });
    expect(draft.aiUsed).toBe(true);
    expect(draft.bodyMd).toContain("Your speaker portal: https://speakerops.example/speaker/spk_tob");
  });

  it("sends the portal link and checklist to the model for acceptances", async () => {
    const { fetcher, calls } = fakeAnthropic(() => ({
      body: {
        id: "msg_accept",
        model: "claude-sonnet-5",
        usage: { input_tokens: 50, output_tokens: 40 },
        content: [
          {
            type: "tool_use",
            input: {
              subject: "S",
              body: "Body with https://speakerops.example/speaker/spk_tob included.",
            },
          },
        ],
      },
    }));
    const draft = await draftDecisionFeedback(APPROVE_INPUT, { apiKey: "k", fetcher });
    const sentPrompt = JSON.stringify(calls[0]!.body.messages);
    expect(sentPrompt).toContain("ACCEPTANCE email");
    expect(sentPrompt).toContain("https://speakerops.example/speaker/spk_tob");
    expect(sentPrompt).toContain("Book your AV check");
    // Link already present — no duplicate appended.
    expect(draft.bodyMd.match(/speaker\/spk_tob/g)).toHaveLength(1);
  });

  it("honors a model override", async () => {
    const { fetcher, calls } = fakeAnthropic(() => ({
      body: {
        id: "msg_override",
        model: "claude-fable-5",
        usage: { input_tokens: 5, output_tokens: 3 },
        content: [{ type: "tool_use", input: { subject: "S", body: "B" } }],
      },
    }));
    await draftDecisionFeedback(INPUT, { apiKey: "k", model: "claude-fable-5", fetcher });
    expect(calls[0]!.body.model).toBe("claude-fable-5");
  });
});
