import type { EvaluationWorkspaceResponse, SubmissionListItem } from "../contracts";

/**
 * CSV building, pure and RFC-4180-shaped: fields containing commas, quotes,
 * or newlines are quoted, quotes double. Excel-friendly CRLF row endings.
 * Never regex a delimited format — build it, don't parse it.
 */

function escapeField(rawValue: string): string {
  // Spreadsheet apps can evaluate user-controlled CSV cells beginning with
  // =, +, -, or @ as formulas. Prefix an apostrophe before RFC-4180 escaping
  // so proposal titles, abstracts, and speaker fields remain inert text.
  const value = /^\s*[=+\-@]/.test(rawValue) ? `'${rawValue}` : rawValue;
  if (/[",\r\n]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

export function toCsv(rows: readonly (readonly string[])[]): string {
  return rows.map((row) => row.map(escapeField).join(",")).join("\r\n") + "\r\n";
}

/** The organizer-facing export: one row per submission, speakers flattened. */
export function submissionsToCsv(submissions: readonly SubmissionListItem[]): string {
  const header = [
    "Title",
    "Status",
    "Track",
    "Format",
    "Speakers",
    "Speaker emails",
    "Companies",
    "Submitted at",
    "Abstract",
    "Committee notes",
    "SpeakerOps ID",
  ];
  const rows = submissions.map((s) => [
    s.title,
    s.status,
    s.trackName ?? "",
    s.format,
    s.speakers.map((sp) => sp.name).join("; "),
    s.speakers.map((sp) => sp.email).join("; "),
    s.speakers
      .map((sp) => sp.company ?? "")
      .filter(Boolean)
      .join("; "),
    s.submittedAt ?? "",
    s.abstract,
    s.reviews
      .map((review) =>
        `${review.reviewerName} (${review.recommendation}): ${review.comment ?? ""}`.trim().replace(/:$/, ""),
      )
      .join(" | "),
    s.id,
  ]);
  return toCsv([header, ...rows]);
}

export function reviewResultsToCsv(workspace: EvaluationWorkspaceResponse): string {
  return toCsv([
    ["Title", "Track", "Weighted aggregate", "Completed reviews", "Submission status", "SpeakerOps ID"],
    ...workspace.results.map((result) => {
      const submission = workspace.submissions.find((item) => item.id === result.submissionId);
      return [
        result.title,
        result.trackName ?? "",
        result.aggregate === null ? "" : result.aggregate.toFixed(2),
        String(result.completedReviews),
        submission?.status ?? "",
        result.submissionId,
      ];
    }),
  ]);
}
