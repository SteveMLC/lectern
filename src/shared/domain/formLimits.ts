/**
 * Submission capacity and combined-length rules.
 *
 * Both live here as pure functions because the browser and the API have to
 * agree exactly: the form shows a live counter and blocks the button, and the
 * API refuses the same submission even when the button is bypassed.
 */

export interface CombinedLengthRule {
  id: string;
  label: string;
  /** Form field keys whose lengths are summed. */
  fieldKeys: string[];
  maxChars: number;
}

export interface CombinedLengthUsage {
  rule: CombinedLengthRule;
  used: number;
  remaining: number;
  overBy: number;
  exceeded: boolean;
}

/**
 * How much of a combined-length budget a set of answers uses. Missing fields
 * count as empty rather than throwing — a rule may name a field that a
 * conditional has hidden, and a hidden field contributes nothing.
 */
export function combinedLengthUsage(
  rule: CombinedLengthRule,
  values: Record<string, unknown>,
): CombinedLengthUsage {
  const used = rule.fieldKeys.reduce((total, key) => {
    const value = values[key];
    return total + (typeof value === "string" ? value.length : 0);
  }, 0);
  const overBy = Math.max(0, used - rule.maxChars);
  return {
    rule,
    used,
    remaining: Math.max(0, rule.maxChars - used),
    overBy,
    exceeded: overBy > 0,
  };
}

/** Every rule this answer set breaks, in rule order. */
export function exceededLengthRules(
  rules: readonly CombinedLengthRule[],
  values: Record<string, unknown>,
): CombinedLengthUsage[] {
  return rules.map((rule) => combinedLengthUsage(rule, values)).filter((usage) => usage.exceeded);
}

/** Reader-facing sentence for a broken rule, e.g. for an inline error. */
export function combinedLengthMessage(usage: CombinedLengthUsage): string {
  return `${usage.rule.label} is ${usage.overBy} character${usage.overBy === 1 ? "" : "s"} over its ${usage.rule.maxChars}-character limit.`;
}

export interface SubmissionCapacity {
  /** Null means the form sets no limit of its own. */
  limit: number | null;
  /** Sent proposals plus saved drafts already held by this submitter. */
  used: number;
}

/**
 * Whether a submitter may start another proposal on this form. The count
 * deliberately includes drafts: the organizer's own control says "includes
 * saved drafts and submitted sessions", because a draft still occupies a slot
 * in the programme they are planning.
 */
export function canSubmitAgain({ limit, used }: SubmissionCapacity): boolean {
  if (limit === null) return true;
  return used < limit;
}

export function submissionLimitMessage({ limit, used }: SubmissionCapacity): string | null {
  if (limit === null || used < limit) return null;
  return limit === 1
    ? "This call accepts one proposal per person, and yours is already in."
    : `This call accepts ${limit} proposals per person, and you already have ${used}.`;
}
