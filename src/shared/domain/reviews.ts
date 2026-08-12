export interface WeightedCriterion {
  key: string;
  weight: number;
}

/** Weighted mean over configured numeric criteria. Missing/non-numeric scores
 * do not dilute the result. */
export function weightedScore(
  scores: Record<string, unknown>,
  criteria: readonly WeightedCriterion[],
): number | null {
  let total = 0;
  let weight = 0;
  for (const criterion of criteria) {
    const score = scores[criterion.key];
    if (typeof score !== "number" || !Number.isFinite(score) || criterion.weight <= 0) continue;
    total += score * criterion.weight;
    weight += criterion.weight;
  }
  return weight > 0 ? total / weight : null;
}

export function aggregateWeightedScores(
  reviews: readonly { scores: Record<string, unknown> }[],
  criteria: readonly WeightedCriterion[],
): number | null {
  const values = reviews
    .map((review) => weightedScore(review.scores, criteria))
    .filter((value): value is number => value !== null);
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** A submitted review remains completed even when its round has no numeric
 * criteria. The aggregate and completion count deliberately answer different
 * questions. */
export function summarizeReviewScores(
  reviews: readonly { scores: Record<string, unknown>; criteria: readonly WeightedCriterion[] }[],
): { aggregate: number | null; completedReviews: number } {
  const values = reviews
    .map((review) => weightedScore(review.scores, review.criteria))
    .filter((value): value is number => value !== null);
  return {
    aggregate: values.length > 0
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : null,
    completedReviews: reviews.length,
  };
}
