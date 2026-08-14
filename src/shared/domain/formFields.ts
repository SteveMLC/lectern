/**
 * CFP question ordering and locking, shared by the organizer's form builder and
 * the worker.
 *
 * A proposal is answered in two places. Four questions — title, abstract,
 * track, format — are columns on `submissions`; the programme reads them
 * directly to schedule, review, and publish a session, so they are locked: the
 * builder shows them, but they can never be removed and never move. Everything
 * else is a row in `form_fields` the organizer owns outright and can reorder,
 * because the stored order is the order a submitter reads.
 *
 * Keeping the lock rule here means the builder, the create route, and the
 * reorder route cannot disagree about which questions the programme depends on.
 */

/** A locked question: the key it is addressable by, and what a submitter sees. */
export interface CoreCfpField {
  key: string;
  label: string;
  /** Mirrors the control the public CFP page renders for this question. */
  fieldType: "text" | "textarea" | "select";
  /** Why the programme cannot do without it, shown under the label. */
  reason: string;
}

/**
 * The four questions every proposal carries, in the order the public CFP page
 * renders them. Stored as columns on `submissions`, not rows in `form_fields`.
 */
export const CORE_CFP_FIELDS: readonly CoreCfpField[] = [
  { key: "title", label: "Session title", fieldType: "text", reason: "Names the session everywhere it appears." },
  { key: "abstract", label: "Abstract", fieldType: "textarea", reason: "The text reviewers score and the programme publishes." },
  { key: "track", label: "Track", fieldType: "select", reason: "Routes the proposal to the right reviewers." },
  { key: "format", label: "Format", fieldType: "select", reason: "Sets session length and drives conditional questions." },
];

const CORE_CFP_FIELD_KEYS = new Set(CORE_CFP_FIELDS.map((field) => field.key));

/**
 * True when a question is one the programme depends on: locked in the builder,
 * and refused as a custom field key so a custom question can never shadow one.
 */
export function isLockedCfpField(key: string): boolean {
  return CORE_CFP_FIELD_KEYS.has(key.trim().toLowerCase());
}

/**
 * One question lifted out of the order and put back at `toIndex`. Returns the
 * order unchanged when the move is impossible — an unknown id, an index off
 * either end — so no caller has to bounds-check before asking.
 */
export function moveFieldToIndex(
  fieldIds: readonly string[],
  fieldId: string,
  toIndex: number,
): string[] {
  const from = fieldIds.indexOf(fieldId);
  if (from === -1 || toIndex < 0 || toIndex >= fieldIds.length) return [...fieldIds];
  const next = [...fieldIds];
  const [moved] = next.splice(from, 1);
  if (moved === undefined) return [...fieldIds];
  next.splice(toIndex, 0, moved);
  return next;
}

/** What "move up" and "move down" do: one place, and nothing at the ends. */
export function moveFieldOrder(
  fieldIds: readonly string[],
  fieldId: string,
  direction: "up" | "down",
): string[] {
  const from = fieldIds.indexOf(fieldId);
  if (from === -1) return [...fieldIds];
  return moveFieldToIndex(fieldIds, fieldId, direction === "up" ? from - 1 : from + 1);
}

/** What a drag does: the dragged question takes the target's place, and the
 *  questions it passed over close up behind it. */
export function dropFieldOnto(
  fieldIds: readonly string[],
  fieldId: string,
  targetFieldId: string,
): string[] {
  return moveFieldToIndex(fieldIds, fieldId, fieldIds.indexOf(targetFieldId));
}

/**
 * Why a submitted order cannot be applied, phrased for the organizer, or null
 * when it is a clean permutation of the stored fields. The contract is the full
 * ordered list, so a partial list is a bug rather than a partial update.
 */
export function fieldOrderError(
  storedIds: readonly string[],
  requestedIds: readonly string[],
): string | null {
  if (new Set(requestedIds).size !== requestedIds.length) {
    return "The submitted order lists the same question twice.";
  }
  if (requestedIds.length !== storedIds.length) {
    return `The submitted order has ${requestedIds.length} question${requestedIds.length === 1 ? "" : "s"} but this form has ${storedIds.length}. Send the whole order.`;
  }
  const stored = new Set(storedIds);
  const unknown = requestedIds.find((id) => !stored.has(id));
  if (unknown !== undefined) return `“${unknown}” is not a question on this form.`;
  return null;
}
