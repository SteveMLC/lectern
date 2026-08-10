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
