import type { ConditionalRule, FormField } from "../contracts";

/**
 * Conditional form logic, shared by the CFP UI (live show/hide) and the worker
 * (server-side required-field enforcement). Both sides evaluate the same rules,
 * so a field hidden in the browser is never demanded by the API.
 *
 * Core fields (like "format") are addressable as rule sources by their key;
 * custom field values come from the answers map.
 */

export interface RuleContext {
  /** Core field: the proposal format. */
  format: string;
  /** Custom field answers, keyed by field key. */
  answers: Record<string, unknown>;
}

function sourceValue(key: string, ctx: RuleContext): string {
  const raw = key === "format" ? ctx.format : ctx.answers[key];
  if (raw === undefined || raw === null) return "";
  return String(raw);
}

function ruleMatches(rule: ConditionalRule, ctx: RuleContext): boolean {
  const value = sourceValue(rule.sourceFieldKey, ctx);
  switch (rule.operator) {
    case "equals":
      return value === (rule.values[0] ?? "");
    case "not_equals":
      return value !== (rule.values[0] ?? "");
    case "in":
      return rule.values.includes(value);
  }
}

/**
 * A field with no rules targeting it is always visible.
 * With show-rules: visible when at least one matches.
 * A matching hide-rule always wins.
 */
export function isFieldVisible(
  field: Pick<FormField, "key">,
  rules: readonly ConditionalRule[],
  ctx: RuleContext,
): boolean {
  const targeting = rules.filter((r) => r.targetFieldKey === field.key);
  if (targeting.length === 0) return true;

  const showRules = targeting.filter((r) => r.action === "show");
  const hideRules = targeting.filter((r) => r.action === "hide");

  let visible = showRules.length === 0 ? true : showRules.some((r) => ruleMatches(r, ctx));
  if (hideRules.some((r) => ruleMatches(r, ctx))) visible = false;
  return visible;
}

/** True when a submitted answer should count as "not provided" for a field. */
export function isAnswerEmpty(field: Pick<FormField, "fieldType">, value: unknown): boolean {
  if (value === undefined || value === null) return true;
  switch (field.fieldType) {
    case "checkbox":
      return value !== true;
    case "multiselect":
      return !Array.isArray(value) || value.length === 0;
    default:
      return String(value).trim() === "";
  }
}

/**
 * Which required fields are actually missing, honoring visibility rules.
 * Hidden fields are never required, whatever their required flag says.
 */
export function missingRequiredFields(
  fields: readonly FormField[],
  rules: readonly ConditionalRule[],
  ctx: RuleContext,
): FormField[] {
  return fields.filter(
    (f) => f.required && isFieldVisible(f, rules, ctx) && isAnswerEmpty(f, ctx.answers[f.key]),
  );
}

/** Keep only answers for known, currently-visible fields. */
export function pruneAnswers(
  fields: readonly FormField[],
  rules: readonly ConditionalRule[],
  ctx: RuleContext,
): Record<string, unknown> {
  const pruned: Record<string, unknown> = {};
  for (const field of fields) {
    if (!isFieldVisible(field, rules, ctx)) continue;
    const value = ctx.answers[field.key];
    if (value === undefined) continue;
    pruned[field.key] = value;
  }
  return pruned;
}
