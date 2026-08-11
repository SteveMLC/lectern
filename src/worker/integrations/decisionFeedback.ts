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
 * deliberately leaves blunt internal reasoning out of the speaker-facing
 * body and tells the organizer to add safe feedback manually. The demo can
 * never break — or leak reviewer notes — on a missing or failing key.
 */

export interface FeedbackDraftInput {
  eventName: string;
  speakerName: string;
  talkTitle: string;
  talkAbstract: string;
  decision: ReviewDecision;
  /** The organizer's internal notes, e.g. "ran this topic last year, abstract has no numbers". */
  reasoning: string;
  /** Approve only: the speaker's portal URL. Guaranteed to appear in the final draft. */
  portalUrl?: string;
  /**
   * Approve only: the onboarding checklist the system derives at acceptance,
   * so the email tells the speaker exactly what happens next.
   */
  onboardingTasks?: string[];
}

export interface ProviderEvidence {
  requestId: string;
  model: string;
  usage: {
    inputTokens: number;
    cacheCreationInputTokens: number;
    cacheCreation5mInputTokens: number;
    cacheCreation1hInputTokens: number;
    cacheReadInputTokens: number;
    outputTokens: number;
  };
}

export interface FeedbackDraft {
  subject: string;
  bodyMd: string;
  aiUsed: boolean;
  model?: string;
  note?: string;
  providerEvidence?: ProviderEvidence;
}

// ---------------------------------------------------------------------------
// Deterministic fallback — always available, never copies internal reasoning
// ---------------------------------------------------------------------------

/** The next-steps block shared by both the template and the AI guarantee. */
function acceptanceNextSteps(input: FeedbackDraftInput): string {
  const tasks = (input.onboardingTasks ?? []).filter((t) => t.trim());
  const taskBlock = tasks.length
    ? `Your speaker portal lists a short onboarding checklist:\n\n${tasks.map((t) => `- ${t}`).join("\n")}\n\n`
    : "";
  const portalBlock = input.portalUrl
    ? `Everything happens in your speaker portal — profile, uploads, and your checklist:\n${input.portalUrl}\n\n`
    : "";
  return `${taskBlock}${portalBlock}`;
}

export function deterministicDraft(input: FeedbackDraftInput): FeedbackDraft {
  const firstName = input.speakerName.split(/\s+/)[0] ?? input.speakerName;

  if (input.decision === "approve") {
    return {
      subject: `You're speaking at ${input.eventName}: “${input.talkTitle}”`,
      bodyMd: `Hi ${firstName},

Great news — “${input.talkTitle}” is accepted for ${input.eventName}. Your session is now part of the program, and we're glad to have you.

${acceptanceNextSteps(input)}We'll follow up with your exact day, time, and room once the schedule is locked. Reply to this email with any questions in the meantime.

Welcome aboard,
The ${input.eventName} program team`,
      aiUsed: false,
      note: input.reasoning.trim()
        ? "Template draft — your internal note was saved to the committee record but not copied into this email. Personalize it manually, or configure AI-assisted drafting."
        : "Template draft — set ANTHROPIC_API_KEY to enable AI-assisted drafting.",
    };
  }

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
${closing}

Thanks again for taking the time to submit.

The ${input.eventName} program team`,
    aiUsed: false,
    note: input.reasoning.trim()
      ? "Template draft — your internal reasoning was not copied into this email. Add speaker-safe feedback manually, or configure AI-assisted drafting."
      : "Template draft — set ANTHROPIC_API_KEY to enable AI-assisted drafting.",
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
  if (input.decision === "approve") {
    const tasks = (input.onboardingTasks ?? []).filter((t) => t.trim());
    return `You are drafting an ACCEPTANCE email for a conference organizer to send to a speaker.

Event: ${input.eventName}
Speaker: ${input.speakerName}
Accepted proposal: ${input.talkTitle}
Proposal abstract: ${input.talkAbstract}

The organizer's INTERNAL note (may be blunt or logistical, not speaker-facing):
${input.reasoning || "(none given)"}

Write the email the organizer should send. Requirements:
- Genuinely warm congratulations without gushing. Acceptance must be
  unmistakable in the first sentence.
- If the internal note contains something worth telling the speaker (e.g.
  what the committee liked), convey it kindly — never quote it verbatim.
  Ignore parts that are purely internal.
- Include this exact speaker-portal link on its own line: ${input.portalUrl ?? "(no portal link)"}
${tasks.length ? `- List these onboarding items exactly, as a markdown list:\n${tasks.map((t) => `  - ${t}`).join("\n")}` : "- Mention that onboarding details live in the portal."}
- Do not invent schedule details (day, time, room) — say those follow once
  the schedule is locked.
- 120-200 words. No subject-line prefix like "Subject:". No placeholders.
- Sign off as "The ${input.eventName} program team".`;
  }

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

/**
 * The one Anthropic call in the product: force the email_draft tool, demand
 * provider usage evidence, and hand back either a usable draft or a clear
 * "unusable" signal. Every email feature (decision feedback, schedule
 * notices) goes through here so evidence capture can never drift.
 */
export async function callDraftTool(
  promptText: string,
  cfg: AnthropicConfig,
): Promise<{ subject: string | null; body: string | null; model: string; providerEvidence: ProviderEvidence }> {
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
      messages: [{ role: "user", content: promptText }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic request failed (${response.status}): ${(await response.text()).slice(0, 300)}`);
  }

  const body = (await response.json()) as {
    id?: unknown;
    model?: unknown;
    usage?: {
      input_tokens?: unknown;
      cache_creation_input_tokens?: unknown;
      cache_read_input_tokens?: unknown;
      output_tokens?: unknown;
      cache_creation?: {
        ephemeral_5m_input_tokens?: unknown;
        ephemeral_1h_input_tokens?: unknown;
      };
    };
    content?: { type: string; input?: { subject?: unknown; body?: unknown } }[];
  };
  const asCounter = (value: unknown, name: string) => {
    if (!Number.isSafeInteger(value) || Number(value) < 0) throw new Error(`Anthropic response is missing ${name}.`);
    return Number(value);
  };
  if (typeof body.id !== "string" || !body.id || !body.usage) {
    throw new Error("Anthropic response did not contain provider usage evidence.");
  }
  const responseModel = typeof body.model === "string" && body.model ? body.model : model;
  const providerEvidence: ProviderEvidence = {
    requestId: body.id,
    model: responseModel,
    usage: {
      inputTokens: asCounter(body.usage.input_tokens, "usage.input_tokens"),
      cacheCreationInputTokens: asCounter(body.usage.cache_creation_input_tokens ?? 0, "usage.cache_creation_input_tokens"),
      cacheCreation5mInputTokens: asCounter(body.usage.cache_creation?.ephemeral_5m_input_tokens ?? 0, "usage.cache_creation.ephemeral_5m_input_tokens"),
      cacheCreation1hInputTokens: asCounter(body.usage.cache_creation?.ephemeral_1h_input_tokens ?? 0, "usage.cache_creation.ephemeral_1h_input_tokens"),
      cacheReadInputTokens: asCounter(body.usage.cache_read_input_tokens ?? 0, "usage.cache_read_input_tokens"),
      outputTokens: asCounter(body.usage.output_tokens, "usage.output_tokens"),
    },
  };

  const toolUse = (body.content ?? []).find((block) => block.type === "tool_use");
  const subject = toolUse?.input?.subject;
  const draftBody = toolUse?.input?.body;
  const usable =
    typeof subject === "string" && typeof draftBody === "string" && subject.trim() && draftBody.trim();
  return {
    subject: usable ? (subject as string).trim() : null,
    body: usable ? (draftBody as string).trim() : null,
    model: responseModel,
    providerEvidence,
  };
}

export async function aiDraft(
  input: FeedbackDraftInput,
  cfg: AnthropicConfig,
): Promise<FeedbackDraft> {
  const result = await callDraftTool(prompt(input), cfg);
  if (result.subject === null || result.body === null) {
    return {
      ...deterministicDraft(input),
      model: result.model,
      note: "AI drafting returned no usable draft, so SpeakerOps used the safe template.",
      providerEvidence: result.providerEvidence,
    };
  }
  return {
    subject: result.subject,
    bodyMd: result.body,
    aiUsed: true,
    model: result.model,
    providerEvidence: result.providerEvidence,
  };
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
    const draft = await aiDraft(input, { apiKey: cfg.apiKey, model: cfg.model, fetcher: cfg.fetcher });
    // Hard guarantee for acceptances: whatever the model writes, the speaker
    // gets their portal link. Appended deterministically if the draft lacks it.
    if (input.decision === "approve" && input.portalUrl && !draft.bodyMd.includes(input.portalUrl)) {
      return { ...draft, bodyMd: `${draft.bodyMd}\n\nYour speaker portal: ${input.portalUrl}` };
    }
    return draft;
  } catch (error) {
    const fallback = deterministicDraft(input);
    return {
      ...fallback,
      note: `AI drafting unavailable (${error instanceof Error ? error.message.slice(0, 120) : "error"}); template draft used.`,
    };
  }
}
