import {
  type AnthropicConfig,
  type FeedbackDraft,
  callDraftTool,
} from "./decisionFeedback";

/**
 * Schedule notices: once a session is slotted, tell its speakers exactly
 * when and where they are on — deliberately, never as a side effect of
 * dragging (organizers rearrange programs constantly; auto-fire would be
 * spam and would break the "nothing auto-sends" rule).
 *
 * The facts a speaker must not get wrong — day, time with timezone, room —
 * are formatted once here and required VERBATIM in the AI draft, then
 * guaranteed deterministically: if the model's draft lacks the slot line, a
 * correct one is appended. A model can rephrase warmth; it is never allowed
 * to restate the time in its own words.
 */

export interface ScheduleNoticeInput {
  eventName: string;
  talkTitle: string;
  /** Billing order; greeting uses first names. */
  speakerNames: string[];
  /** e.g. "Thursday, September 10 · 2:30 – 3:15 PM PDT" — from formatSlotWindow. */
  slotSummary: string;
  roomName: string | null;
  /** Absolute URL of the public program. */
  scheduleUrl: string;
  /** Absolute URL of the session's calendar (.ics) file. */
  icsUrl: string;
  /** Organizer's optional internal note; woven kindly, never quoted. */
  note: string;
}

/** "Thursday, September 10 · 2:30 – 3:15 PM PDT" in the event's timezone. */
export function formatSlotWindow(startsAt: string, endsAt: string, timeZone: string): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const day = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone,
  }).format(start);
  const startTime = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(start);
  const endTime = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
    timeZoneName: "short",
  }).format(end);
  return `${day} · ${startTime} – ${endTime}`;
}

function greeting(names: string[]): string {
  const first = names.map((name) => name.split(/\s+/)[0] ?? name).filter(Boolean);
  if (first.length === 0) return "there";
  if (first.length === 1) return first[0]!;
  if (first.length === 2) return `${first[0]} and ${first[1]}`;
  return `${first.slice(0, -1).join(", ")} and ${first[first.length - 1]}`;
}

/** The slot facts as one block — used by the template and the AI guarantee. */
function slotBlock(input: ScheduleNoticeInput): string {
  return `When: ${input.slotSummary}\nWhere: ${input.roomName ?? "Room to be announced"}`;
}

export function deterministicScheduleNotice(input: ScheduleNoticeInput): FeedbackDraft {
  return {
    subject: `Your ${input.eventName} slot is confirmed: “${input.talkTitle}”`,
    bodyMd: `Hi ${greeting(input.speakerNames)},

Great news — “${input.talkTitle}” now has its slot at ${input.eventName}:

${slotBlock(input)}

Add it to your calendar: ${input.icsUrl}
The full program lives here: ${input.scheduleUrl}

If this time creates a conflict, reply to this email and we will work it out. Otherwise, no action is needed.

See you there,
The ${input.eventName} program team`,
    aiUsed: false,
    note: input.note.trim()
      ? "Template draft — your internal note was not copied into this email. Personalize it manually, or configure AI-assisted drafting."
      : "Template draft — set ANTHROPIC_API_KEY to enable AI-assisted drafting.",
  };
}

function noticePrompt(input: ScheduleNoticeInput): string {
  return `You are drafting a SCHEDULE CONFIRMATION email for a conference organizer to send to the speaker(s) of a session.

Event: ${input.eventName}
Session: ${input.talkTitle}
Speakers: ${input.speakerNames.join(", ")}

The organizer's INTERNAL note (may be blunt or logistical, not speaker-facing):
${input.note || "(none given)"}

Write the email the organizer should send. Requirements:
- Warm and operational: this confirms when and where they speak. 90-150 words.
- Include these two lines VERBATIM, exactly as written, on their own lines —
  never restate the time or room in your own words:
${slotBlock(input)
  .split("\n")
  .map((line) => `  ${line}`)
  .join("\n")}
- Include this exact calendar link on its own line: ${input.icsUrl}
- Include this exact program link on its own line: ${input.scheduleUrl}
- If the internal note contains something worth telling the speakers (e.g.
  why this slot suits their talk), convey it kindly — never quote it
  verbatim. Ignore parts that are purely internal.
- Do not invent logistics (arrival times, AV checks, doors) that are not in
  the note.
- Invite a reply if the time conflicts. No placeholders, no "Subject:" prefix.
- Sign off as "The ${input.eventName} program team".`;
}

/**
 * AI when configured, deterministic otherwise or on failure — and the slot
 * facts are guaranteed on every path: an AI draft missing the verbatim slot
 * block gets a correct one appended.
 */
export async function draftScheduleNotice(
  input: ScheduleNoticeInput,
  cfg: { apiKey?: string; model?: string; fetcher?: AnthropicConfig["fetcher"] },
): Promise<FeedbackDraft> {
  if (!cfg.apiKey) return deterministicScheduleNotice(input);
  try {
    const result = await callDraftTool(noticePrompt(input), {
      apiKey: cfg.apiKey,
      model: cfg.model,
      fetcher: cfg.fetcher,
    });
    if (result.subject === null || result.body === null) {
      return {
        ...deterministicScheduleNotice(input),
        model: result.model,
        note: "AI drafting returned no usable draft, so SpeakerOps used the safe template.",
        providerEvidence: result.providerEvidence,
      };
    }
    let bodyMd = result.body;
    if (!bodyMd.includes(input.slotSummary)) {
      bodyMd = `${bodyMd}\n\n${slotBlock(input)}`;
    }
    if (!bodyMd.includes(input.icsUrl)) {
      bodyMd = `${bodyMd}\nAdd it to your calendar: ${input.icsUrl}`;
    }
    return {
      subject: result.subject,
      bodyMd,
      aiUsed: true,
      model: result.model,
      providerEvidence: result.providerEvidence,
    };
  } catch (error) {
    const fallback = deterministicScheduleNotice(input);
    return {
      ...fallback,
      note: `AI drafting unavailable (${error instanceof Error ? error.message.slice(0, 120) : "error"}); template draft used.`,
    };
  }
}
