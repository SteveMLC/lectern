import type { ReviewDecision } from "../../shared/contracts";

/**
 * Decision-feedback drafting: the organizer's own blunt reasoning in, a
 * thoughtful speaker-facing email out.
 *
 * The design rule (borrowed from the strongest pattern in mature tools):
 * AI PROPOSES, THE HUMAN APPROVES, THE SYSTEM COMMITS. This module only ever
 * returns a draft. Sending stays with the existing simulated-send flow after
 * the organizer has read and edited it. Nothing here writes to the database
 * or contacts a speaker.
 *
 * Without an ANTHROPIC_API_KEY the flow still works: a deterministic template
 * carries the organizer's reasons verbatim, clearly labeled as not
 * AI-assisted. The demo can never break on a missing or failing key.
 */

export interface FeedbackDraftInput {
  eventName: string;
  speakerName: string;
  talkTitle: string;
  talkAbstract: string;
  decision: Extract<ReviewDecision, "deny" | "maybe">;
  /** The organizer's internal notes, e.g. "ran this topic last year, abstract has no numbers". */
  reasoning: string;
}

export interface FeedbackDraft {
  subject: string;
  bodyMd: string;
  aiUsed: boolean;
  model?: string;
  note?: string;
}

// ---------------------------------------------------------------------------
// Deterministic fallback — always available, carries the reasoning verbatim
// ---------------------------------------------------------------------------

export function deterministicDraft(input: FeedbackDraftInput): FeedbackDraft {
  const firstName = input.speakerName.split(/\s+/)[0] ?? input.speakerName;
  const reasons = input.reasoning
    .split(/\r?\n|;/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `- ${line}`)
    .join("\n");

  const opening =
    input.decision === "deny"
      ? `Thank you for proposing “${input.talkTitle}” for ${input.eventName}. After review, we are not able to include it in this year's program.`
      : `Thank you for proposing “${input.talkTitle}” for ${input.eventName}. We have placed it on our waitlist — it is genuinely under consideration as the program firms up.`;

  const closing =
    input.decision === "deny"
      ? `We would be glad to see a proposal from you for a future event.`
      : `We will contact you as soon as a slot opens or the program is finalized. No action is needed from you right now.`;

  return {
    subject:
      input.decision === "deny"
        ? `Your ${input.eventName} proposal: “${input.talkTitle}”`
        : `Your ${input.eventName} proposal is waitlisted: “${input.talkTitle}”`,
    bodyMd: `Hi ${firstName},

${opening}
${reasons ? `\nFeedback from the committee:\n\n${reasons}\n` : ""}
${closing}

Thanks again for taking the time to submit.

The ${input.eventName} program team`,
    aiUsed: false,
    note: "Template draft — set ANTHROPIC_API_KEY to enable AI-assisted drafting.",
  };
}

// ---------------------------------------------------------------------------
// AI draft — Claude turns blunt internal reasoning into a kind, specific email
// ---------------------------------------------------------------------------

const DRAFT_TOOL = {
  name: "email_draft",
  description: "The drafted decision email for the speaker.",
  input_schema: {
    type: "object",
    properties: {
      subject: { type: "string", description: "Email subject line." },
      body: { type: "string", description: "Email body in plain markdown, ready to send." },
    },
    required: ["subject", "body"],
    additionalProperties: false,
  },
} as const;

function prompt(input: FeedbackDraftInput): string {
  const decisionWord = input.decision === "deny" ? "declined" : "waitlisted";
  return `You are drafting a decision email for a conference organizer to send to a speaker.

Event: ${input.eventName}
Speaker: ${input.speakerName}
Proposal title: ${input.talkTitle}
Proposal abstract: ${input.talkAbstract}
Decision: ${decisionWord}

The organizer's INTERNAL notes on why (blunt, not speaker-facing):
${input.reasoning || "(none given — keep feedback general but honest)"}

Write the email the organizer should send. Requirements:
- Warm, direct, and specific. Translate the internal notes into constructive,
  respectful feedback the speaker can actually use. Never quote the notes
  verbatim if they are blunt; convey the substance kindly.
- Do not invent reasons that are not in the notes, and do not soften the
  decision into ambiguity — ${decisionWord} must be unmistakable.
- For waitlisted: make clear it is a genuine hold, what happens next, and that
  no action is needed.
- For declined: one sentence inviting future proposals. No false promises.
- 120-180 words. No subject-line prefix like "Subject:". No placeholders.
- Sign off as "The ${input.eventName} program team".`;
}

export interface AnthropicConfig {
  apiKey: string;
  model?: string;
  fetcher?: typeof fetch;
}

export async function aiDraft(
  input: FeedbackDraftInput,
  cfg: AnthropicConfig,
): Promise<FeedbackDraft> {
  const doFetch = cfg.fetcher ?? ((req: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => fetch(req, init));
  const model = cfg.model ?? "claude-sonnet-5";

  const response = await doFetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": cfg.apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 800,
      tools: [DRAFT_TOOL],
      tool_choice: { type: "tool", name: "email_draft" },
      messages: [{ role: "user", content: prompt(input) }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic request failed (${response.status}): ${(await response.text()).slice(0, 300)}`);
  }

  const body = (await response.json()) as {
    content?: { type: string; input?: { subject?: unknown; body?: unknown } }[];
  };
  const toolUse = (body.content ?? []).find((block) => block.type === "tool_use");
  const subject = toolUse?.input?.subject;
  const draftBody = toolUse?.input?.body;
  if (typeof subject !== "string" || typeof draftBody !== "string" || !subject.trim() || !draftBody.trim()) {
    throw new Error("Anthropic response did not contain a usable draft.");
  }

  return { subject: subject.trim(), bodyMd: draftBody.trim(), aiUsed: true, model };
}

/**
 * The orchestrator: AI when configured, deterministic otherwise, and
 * deterministic again if the AI call fails for any reason. A failing model
 * must degrade to a working template, never to an error in the organizer's
 * face mid-decision.
 */
export async function draftDecisionFeedback(
  input: FeedbackDraftInput,
  cfg: { apiKey?: string; model?: string; fetcher?: typeof fetch },
): Promise<FeedbackDraft> {
  if (!cfg.apiKey) return deterministicDraft(input);
  try {
    return await aiDraft(input, { apiKey: cfg.apiKey, model: cfg.model, fetcher: cfg.fetcher });
  } catch (error) {
    const fallback = deterministicDraft(input);
    return {
      ...fallback,
      note: `AI drafting unavailable (${error instanceof Error ? error.message.slice(0, 120) : "error"}); template draft used.`,
    };
  }
}
