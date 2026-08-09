/**
 * Stable string IDs with a per-entity prefix, e.g. `sub_4kv09txq2mfj`.
 * Seed data uses hand-written IDs in the same shape so demo URLs stay readable.
 */

const ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz";

export function randomId(prefix: string): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  let body = "";
  for (const b of bytes) body += ALPHABET[b % 32];
  return `${prefix}_${body}`;
}

export const idPrefix = {
  event: "evt",
  track: "trk",
  room: "room",
  form: "form",
  formField: "ff",
  conditionalRule: "rule",
  speaker: "spk",
  speakerAsset: "asset",
  submission: "sub",
  evaluationPlan: "plan",
  evaluationRound: "round",
  review: "rev",
  rubricCriterion: "crit",
  session: "ses",
  agendaSlot: "slot",
  taskDefinition: "taskdef",
  speakerTask: "task",
  messageTemplate: "tmpl",
  message: "msg",
  deliveryAttempt: "del",
  resourcePage: "page",
  integrationConnection: "conn",
  syncRun: "sync",
  externalIdMap: "ext",
} as const;
