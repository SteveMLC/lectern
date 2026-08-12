/**
 * CFP window logic, shared by the public UI (to render open/closed state) and
 * the worker (to reject submissions to a closed form). Clock is injected.
 */
export function isCfpOpen(
  form: { isOpen: boolean; opensAt: string | null; closesAt: string | null },
  nowIso: string,
): boolean {
  if (!form.isOpen) return false;
  const now = Date.parse(nowIso);
  if (Number.isNaN(now)) throw new TypeError(`Invalid now timestamp: ${JSON.stringify(nowIso)}`);
  if (form.opensAt !== null && now < Date.parse(form.opensAt)) return false;
  if (form.closesAt !== null && now >= Date.parse(form.closesAt)) return false;
  return true;
}

export function canEditSpeakerProposal(
  form: { isOpen: boolean; opensAt: string | null; closesAt: string | null },
  status: string,
  nowIso: string,
): boolean {
  return ["draft", "submitted", "under_review"].includes(status) && isCfpOpen(form, nowIso);
}

/** Exact, user-facing reason a proposal cannot be edited. Keeping this shared
 * prevents the portal and API from contradicting each other. */
export function speakerProposalLockReason(
  form: { isOpen: boolean; opensAt: string | null; closesAt: string | null },
  status: string,
  nowIso: string,
): string | null {
  if (!["draft", "submitted", "under_review"].includes(status)) {
    return "Editing is locked because the committee has made a decision.";
  }
  if (canEditSpeakerProposal(form, status, nowIso)) return null;

  const now = Date.parse(nowIso);
  if (form.closesAt !== null && now >= Date.parse(form.closesAt)) {
    const closeDate = new Date(form.closesAt).toLocaleDateString("en-US", {
      dateStyle: "long",
      timeZone: "UTC",
    });
    return `Editing is locked because the call for speakers closed on ${closeDate}.`;
  }
  if (form.opensAt !== null && now < Date.parse(form.opensAt)) {
    return "Editing is locked because the call for speakers has not opened yet.";
  }
  return "Editing is locked because the organizer closed the call for speakers.";
}
