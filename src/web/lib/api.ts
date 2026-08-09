import type { z } from "zod";
import {
  ApiError,
  CfpSubmissionRequest,
  CreateSubmissionResponse,
  EventBundle,
  EventCounts,
  EventsListResponse,
  HealthResponse,
  SubmissionsListResponse,
} from "../../shared/contracts";

/**
 * Typed API client. Every response is parsed with the shared Zod contract, so
 * API drift shows up as a loud error instead of quiet undefineds.
 *
 * The organizer passcode is entered at runtime and kept in sessionStorage —
 * it is never part of the built bundle.
 */

const PASSCODE_KEY = "speakerops.organizer.passcode";

export function getPasscode(): string | null {
  return sessionStorage.getItem(PASSCODE_KEY);
}

export function setPasscode(value: string): void {
  sessionStorage.setItem(PASSCODE_KEY, value);
}

export function clearPasscode(): void {
  sessionStorage.removeItem(PASSCODE_KEY);
}

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly issues?: unknown[],
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

async function request<S extends z.ZodType>(
  schema: S,
  path: string,
  init?: RequestInit,
  opts?: { auth?: boolean },
): Promise<z.infer<S>> {
  const headers: Record<string, string> = {};
  if (init?.body !== undefined) headers["content-type"] = "application/json";
  if (opts?.auth) {
    const passcode = getPasscode();
    if (passcode) headers.authorization = `Bearer ${passcode}`;
  }

  const res = await fetch(path, { ...init, headers });

  if (!res.ok) {
    let code = "http_error";
    let message = `Request failed (${res.status}).`;
    let issues: unknown[] | undefined;
    try {
      const parsed = ApiError.safeParse(await res.json());
      if (parsed.success) {
        code = parsed.data.error.code;
        message = parsed.data.error.message;
        issues = parsed.data.error.issues;
      }
    } catch {
      // non-JSON error body; keep defaults
    }
    throw new ApiRequestError(res.status, code, message, issues);
  }

  return schema.parse(await res.json()) as z.infer<S>;
}

export const apiClient = {
  health: () => request(HealthResponse, "/api/health"),

  events: () => request(EventsListResponse, "/api/events"),

  eventBundle: (slug: string) => request(EventBundle, `/api/events/${encodeURIComponent(slug)}`),

  submitCfp: (slug: string, body: CfpSubmissionRequest) =>
    request(CreateSubmissionResponse, `/api/events/${encodeURIComponent(slug)}/submissions`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  submissions: (slug: string) =>
    request(
      SubmissionsListResponse,
      `/api/events/${encodeURIComponent(slug)}/submissions`,
      undefined,
      { auth: true },
    ),

  counts: (slug: string) =>
    request(EventCounts, `/api/events/${encodeURIComponent(slug)}/counts`, undefined, {
      auth: true,
    }),

  /** Verifies a candidate passcode against the API without storing it first. */
  verifyPasscode: async (candidate: string): Promise<boolean> => {
    const res = await fetch("/api/admin/ping", {
      headers: { authorization: `Bearer ${candidate}` },
    });
    return res.status === 204;
  },
};
