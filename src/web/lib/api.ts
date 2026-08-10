import { z } from "zod";
import {
  ApiError,
  AgendaSlotRequest,
  CfpSubmissionRequest,
  CreateDirectSessionRequest,
  CreateDirectSessionResponse,
  CreateSubmissionResponse,
  EventBundle,
  EventCounts,
  EventSummary,
  EventsListResponse,
  HealthResponse,
  OrganizerAgendaResponse,
  PublicScheduleResponse,
  PublicSessionsResponse,
  PublicSpeakersResponse,
  ResourcePage,
  SessionFormat,
  Speaker,
  SpeakerAsset,
  SpeakerTask,
  SubmissionDecisionRequest,
  SubmissionDecisionResponse,
  SubmissionsListResponse,
  TaskDefinition,
} from "../../shared/contracts";

/**
 * Typed API client. Every response is parsed with the shared Zod contract, so
 * API drift shows up as a loud error instead of quiet undefineds.
 *
 * The organizer passcode is entered at runtime and kept in sessionStorage —
 * it is never part of the built bundle.
 */

const PASSCODE_KEY = "speakerops.organizer.passcode";

const SpeakerPortalSession = z.object({
  id: z.string(),
  title: z.string(),
  abstract: z.string(),
  format: SessionFormat,
  startsAt: z.iso.datetime({ offset: true }).nullable(),
  endsAt: z.iso.datetime({ offset: true }).nullable(),
  roomName: z.string().nullable(),
});

export const SpeakerPortalResponse = z.object({
  event: EventSummary,
  speaker: Speaker,
  sessions: z.array(SpeakerPortalSession),
  tasks: z.array(
    z.object({
      task: SpeakerTask,
      definition: TaskDefinition,
    }),
  ),
  assets: z.array(SpeakerAsset),
  resources: z.array(ResourcePage),
});
export type SpeakerPortalResponse = z.infer<typeof SpeakerPortalResponse>;

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

  publicSchedule: (slug: string) =>
    request(PublicScheduleResponse, `/api/public/events/${encodeURIComponent(slug)}/schedule`),

  publicSessions: (slug: string) =>
    request(PublicSessionsResponse, `/api/public/events/${encodeURIComponent(slug)}/sessions`),

  publicSpeakers: (slug: string) =>
    request(PublicSpeakersResponse, `/api/public/events/${encodeURIComponent(slug)}/speakers`),

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

  decideSubmission: (slug: string, submissionId: string, body: SubmissionDecisionRequest) =>
    request(
      SubmissionDecisionResponse,
      `/api/events/${encodeURIComponent(slug)}/submissions/${encodeURIComponent(submissionId)}/decision`,
      { method: "POST", body: JSON.stringify(body) },
      { auth: true },
    ),

  counts: (slug: string) =>
    request(EventCounts, `/api/events/${encodeURIComponent(slug)}/counts`, undefined, {
      auth: true,
    }),

  agenda: (slug: string) =>
    request(OrganizerAgendaResponse, `/api/events/${encodeURIComponent(slug)}/agenda`, undefined, {
      auth: true,
    }),

  createDirectSession: (slug: string, body: CreateDirectSessionRequest) =>
    request(
      CreateDirectSessionResponse,
      `/api/events/${encodeURIComponent(slug)}/sessions`,
      { method: "POST", body: JSON.stringify(body) },
      { auth: true },
    ),

  placeSession: (slug: string, sessionId: string, body: AgendaSlotRequest) =>
    request(
      OrganizerAgendaResponse,
      `/api/events/${encodeURIComponent(slug)}/sessions/${encodeURIComponent(sessionId)}/slot`,
      { method: "PUT", body: JSON.stringify(body) },
      { auth: true },
    ),

  speakerPortal: (token: string) =>
    request(SpeakerPortalResponse, `/api/speaker-portal/${encodeURIComponent(token)}`),

  /** Verifies a candidate passcode against the API without storing it first. */
  verifyPasscode: async (candidate: string): Promise<boolean> => {
    const res = await fetch("/api/admin/ping", {
      headers: { authorization: `Bearer ${candidate}` },
    });
    return res.status === 204;
  },
};
