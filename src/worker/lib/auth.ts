import { createMiddleware } from "hono/factory";
import type { Env } from "../env";
import { errorResponse } from "./http";

/** Constant-time string comparison; never leaks length or prefix timing. */
function timingSafeEqualStr(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  let diff = ab.length ^ bb.length;
  const len = Math.max(ab.length, bb.length);
  for (let i = 0; i < len; i++) diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  return diff === 0;
}

/**
 * Organizer console auth: `Authorization: Bearer <ORGANIZER_PASSCODE>`.
 * The passcode is entered at runtime in the UI and held in sessionStorage —
 * it is never baked into the client bundle.
 */
export const organizerAuth = createMiddleware<{ Bindings: Env }>(async (c, next) => {
  const configured = c.env.ORGANIZER_PASSCODE;
  if (!configured) {
    return errorResponse(500, "not_configured", "ORGANIZER_PASSCODE is not configured.");
  }
  const header = c.req.header("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
  if (!token || !timingSafeEqualStr(token, configured)) {
    return errorResponse(401, "unauthorized", "Organizer passcode required.");
  }
  await next();
});
