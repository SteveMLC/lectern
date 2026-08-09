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
