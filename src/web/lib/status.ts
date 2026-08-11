import type { SubmissionStatus } from "../../shared/contracts";
import type { BadgeTone } from "../components/ui";

export const STATUS_TONE: Record<SubmissionStatus, BadgeTone> = {
  draft: "zinc",
  submitted: "sky",
  under_review: "amber",
  accepted: "emerald",
  rejected: "rose",
  waitlisted: "violet",
  withdrawn: "zinc",
};

export const STATUS_LABEL: Record<SubmissionStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  under_review: "Under review",
  accepted: "Accepted",
  rejected: "Rejected",
  waitlisted: "Waitlisted",
  withdrawn: "Withdrawn",
};

/**
 * Where a proposal actually stands, derived from evidence rather than a
 * stored label. "Submitted" alone never told an organizer whether anyone had
 * looked at it; committee notes do, and they cannot drift out of sync with
 * the truth the way a hand-set status can.
 */
export function pipelineStage(submission: {
  status: SubmissionStatus;
  reviews: { reviewerName: string }[];
}): { label: string; tone: BadgeTone; detail: string } {
  const noteCount = submission.reviews.length;
  const notes = `${noteCount} committee note${noteCount === 1 ? "" : "s"}`;

  switch (submission.status) {
    case "accepted":
      return { label: "Accepted", tone: "emerald", detail: "Live in the program" };
    case "rejected":
      return { label: "Denied", tone: "rose", detail: notes };
    case "waitlisted":
      return { label: "Waitlisted", tone: "violet", detail: notes };
    case "draft":
      return { label: "Draft", tone: "zinc", detail: "Not submitted yet" };
    case "withdrawn":
      return { label: "Withdrawn", tone: "zinc", detail: "Pulled by the speaker" };
    default:
      return noteCount > 0
        ? { label: "Under review", tone: "amber", detail: notes }
        : { label: "Awaiting first look", tone: "sky", detail: "No committee notes yet" };
  }
}

/** "2026-10-14" -> "Oct 14, 2026" without timezone drift. */
export function formatDateOnly(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return isoDate;
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateRange(startsOn: string, endsOn: string): string {
  if (startsOn === endsOn) return formatDateOnly(startsOn);
  return `${formatDateOnly(startsOn)} – ${formatDateOnly(endsOn)}`;
}

export function formatDateTime(iso: string | null, timeZone?: string): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    ...(timeZone ? { timeZone } : {}),
  });
}
