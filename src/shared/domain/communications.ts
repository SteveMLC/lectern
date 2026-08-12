export interface SpeakerMessageTokens {
  speakerName: string;
  eventName: string;
  portalUrl: string;
}

/** Render the documented organizer tokens once per recipient. Unknown tokens
 * stay untouched so an accidental typo remains visible in the outbox. */
export function personalizeSpeakerMessage(template: string, tokens: SpeakerMessageTokens): string {
  const replacements: Record<string, string> = {
    "{{speaker_name}}": tokens.speakerName,
    "{{event_name}}": tokens.eventName,
    "{{portal_link}}": tokens.portalUrl,
  };
  return Object.entries(replacements).reduce(
    (rendered, [token, replacement]) => rendered.replaceAll(token, replacement),
    template,
  );
}
