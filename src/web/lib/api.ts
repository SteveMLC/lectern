import { z } from "zod";
import {
  ApiError,
  AgendaSlotRequest,
  AssetKind,
  OrganizerSession,
  UpdateSessionRequest,
  SessionContentApprovalRequest,
  SessionVersionsResponse,
  AirtableMirrorStatusResponse,
  CfpSubmissionRequest,
  CfpDraftRequest,
  CfpDraftResponse,
  CommunicationKind,
  CommunicationPreviewResponse,
  CreateDirectSessionRequest,
  CreateDirectSessionResponse,
  CreateSubmissionResponse,
  SpeakerLinksRecoveryResponse,
  SubmitterAccountSignupRequest,
  SubmitterAccountLoginRequest,
  SubmitterAccountSessionResponse,
  SubmitterAccountDashboardResponse,
  EventBundle,
  EventCounts,
  EvaluationWorkspaceResponse,
  EventsListResponse,
  CreateEventRequest,
  UpdateEventSettingsRequest,
  CreateTrackRequest,
  CreateRoomRequest,
  CreateFormFieldRequest,
  FeedbackDraftRequest,
  FeedbackDraftResponse,
  ScheduleNoticeDraftRequest,
  ScheduleNoticeDraftResponse,
  HealthResponse,
  OrganizerAgendaResponse,
  PublishAgendaResponse,
  PublicScheduleResponse,
  PublicSessionsResponse,
  PublicSpeakersResponse,
  OrganizerSpeakersResponse,
  CreateOrganizerSpeakerRequest,
  UpdateOrganizerSpeakerRequest,
  OrganizerSpeakerMutationResponse,
  ImportOrganizerSpeakersRequest,
  ImportOrganizerSpeakersResponse,
  CreateSpeakerTaskRequest,
  CreateSpeakerTaskResponse,
  UpdateSpeakerTaskDueDateRequest,
  UpdateSpeakerTaskDueDateResponse,
  BulkTaskReminderRequest,
  BulkTaskReminderResponse,
  BulkAssetDownloadRequest,
  CreateAssetCommentRequest,
  AssetCommentResponse,
  BulkCommunicationRequest,
  BulkCommunicationResponse,
  SpeakerPortalResponse,
  SimulateCommunicationRequest,
  SimulateCommunicationResponse,
  SubmissionDecisionRequest,
  SubmissionDecisionResponse,
  SubmissionsListResponse,
  UpdateSpeakerProfileRequest,
  UpdateSpeakerTaskRequest,
  UpdateSpeakerProposalRequest,
  SaveEvaluationRoundRequest,
  SaveRoundReviewerRequest,
  SaveAssignmentsRequest,
  SubmitReviewRequest,
  ReviewerQueueResponse,
  ReviewScoreDraftResponse,
  OutboxResponse,
  UploadAssetResponse,
} from "../../shared/contracts";

/**
 * Typed API client. Every response is parsed with the shared Zod contract, so
 * API drift shows up as a loud error instead of quiet undefineds.
 *
 * The organizer passcode is entered at runtime and kept in sessionStorage —
 * it is never part of the built bundle.
 */

const PASSCODE_KEY = "lectern.organizer.passcode";

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
  new Headers(init?.headers).forEach((value, key) => { headers[key] = value; });
  if (init?.body !== undefined && !(init.body instanceof FormData)) {
    headers["content-type"] = "application/json";
  }
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

  createEvent: (body: CreateEventRequest) => request(EventBundle, "/api/events", { method: "POST", body: JSON.stringify(body) }, { auth: true }),

  eventBundle: (slug: string) => request(EventBundle, `/api/events/${encodeURIComponent(slug)}`),

  updateEventSettings: (slug: string, body: UpdateEventSettingsRequest) => request(EventBundle, `/api/events/${encodeURIComponent(slug)}`, { method: "PATCH", body: JSON.stringify(body) }, { auth: true }),

  createTrack: (slug: string, body: CreateTrackRequest) => request(EventBundle, `/api/events/${encodeURIComponent(slug)}/tracks`, { method: "POST", body: JSON.stringify(body) }, { auth: true }),

  createRoom: (slug: string, body: CreateRoomRequest) => request(EventBundle, `/api/events/${encodeURIComponent(slug)}/rooms`, { method: "POST", body: JSON.stringify(body) }, { auth: true }),

  createFormField: (slug: string, body: CreateFormFieldRequest) => request(EventBundle, `/api/events/${encodeURIComponent(slug)}/cfp/fields`, { method: "POST", body: JSON.stringify(body) }, { auth: true }),

  publicSchedule: (slug: string) =>
    request(PublicScheduleResponse, `/api/public/events/${encodeURIComponent(slug)}/schedule`),

  publicSessions: (slug: string) =>
    request(PublicSessionsResponse, `/api/public/events/${encodeURIComponent(slug)}/sessions`),

  publicSpeakers: (slug: string) =>
    request(PublicSpeakersResponse, `/api/public/events/${encodeURIComponent(slug)}/speakers`),

  organizerSpeakers: (slug: string) =>
    request(OrganizerSpeakersResponse, `/api/events/${encodeURIComponent(slug)}/speakers`, undefined, { auth: true }),

  createOrganizerSpeaker: (slug: string, body: CreateOrganizerSpeakerRequest) =>
    request(
      OrganizerSpeakerMutationResponse,
      `/api/events/${encodeURIComponent(slug)}/speakers`,
      { method: "POST", body: JSON.stringify(body) },
      { auth: true },
    ),

  updateOrganizerSpeaker: (slug: string, speakerId: string, body: UpdateOrganizerSpeakerRequest) =>
    request(
      OrganizerSpeakerMutationResponse,
      `/api/events/${encodeURIComponent(slug)}/speakers/${encodeURIComponent(speakerId)}`,
      { method: "PATCH", body: JSON.stringify(body) },
      { auth: true },
    ),

  importOrganizerSpeakers: (slug: string, body: ImportOrganizerSpeakersRequest) =>
    request(
      ImportOrganizerSpeakersResponse,
      `/api/events/${encodeURIComponent(slug)}/speakers/import`,
      { method: "POST", body: JSON.stringify(body) },
      { auth: true },
    ),

  createSpeakerTask: (slug: string, body: CreateSpeakerTaskRequest) =>
    request(
      CreateSpeakerTaskResponse,
      `/api/events/${encodeURIComponent(slug)}/speaker-tasks`,
      { method: "POST", body: JSON.stringify(body) },
      { auth: true },
    ),

  updateSpeakerTaskDueDate: (slug: string, definitionId: string, body: UpdateSpeakerTaskDueDateRequest) =>
    request(
      UpdateSpeakerTaskDueDateResponse,
      `/api/events/${encodeURIComponent(slug)}/speaker-tasks/${encodeURIComponent(definitionId)}`,
      { method: "PATCH", body: JSON.stringify(body) },
      { auth: true },
    ),

  remindSpeakerTasks: (slug: string, body: BulkTaskReminderRequest) =>
    request(
      BulkTaskReminderResponse,
      `/api/events/${encodeURIComponent(slug)}/speaker-tasks/remind`,
      { method: "POST", body: JSON.stringify(body) },
      { auth: true },
    ),

  downloadAssetZip: async (slug: string, body: BulkAssetDownloadRequest): Promise<Blob> => {
    const passcode = getPasscode();
    const res = await fetch(`/api/events/${encodeURIComponent(slug)}/assets/download.zip`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(passcode ? { authorization: `Bearer ${passcode}` } : {}) },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      let code = "http_error";
      let message = `Archive request failed (${res.status}).`;
      try {
        const parsed = ApiError.safeParse(await res.json());
        if (parsed.success) { code = parsed.data.error.code; message = parsed.data.error.message; }
      } catch { /* binary/non-JSON error; keep fallback */ }
      throw new ApiRequestError(res.status, code, message);
    }
    return res.blob();
  },

  downloadEvaluationCsv: async (slug: string): Promise<Blob> => {
    const passcode = getPasscode();
    const res = await fetch(`/api/events/${encodeURIComponent(slug)}/evaluations.csv`, {
      headers: passcode ? { authorization: `Bearer ${passcode}` } : {},
    });
    if (!res.ok) {
      let message = `Review export failed (${res.status}).`;
      try {
        const parsed = ApiError.safeParse(await res.json());
        if (parsed.success) message = parsed.data.error.message;
      } catch { /* non-JSON error; keep fallback */ }
      throw new ApiRequestError(res.status, "evaluation_export_failed", message);
    }
    return res.blob();
  },

  sendBulkCommunication: (slug: string, body: BulkCommunicationRequest) =>
    request(
      BulkCommunicationResponse,
      `/api/events/${encodeURIComponent(slug)}/communications/bulk`,
      { method: "POST", body: JSON.stringify(body) },
      { auth: true },
    ),

  submitCfp: (slug: string, body: CfpSubmissionRequest, submitterToken?: string | null) =>
    request(CreateSubmissionResponse, `/api/events/${encodeURIComponent(slug)}/submissions`, {
      method: "POST",
      headers: submitterToken ? { "x-lectern-submitter": submitterToken } : undefined,
      body: JSON.stringify(body),
    }),

  createSubmitterAccount: (slug: string, body: SubmitterAccountSignupRequest) =>
    request(SubmitterAccountSessionResponse, `/api/events/${encodeURIComponent(slug)}/submitter-accounts`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  signInSubmitterAccount: (slug: string, body: SubmitterAccountLoginRequest) =>
    request(SubmitterAccountSessionResponse, `/api/events/${encodeURIComponent(slug)}/submitter-sessions`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  submitterDashboard: (slug: string, sessionToken: string) =>
    request(SubmitterAccountDashboardResponse, `/api/events/${encodeURIComponent(slug)}/submitter-dashboard`, {
      headers: { "x-lectern-submitter": sessionToken },
    }),

  recoverSpeakerLinks: (slug: string, email: string) =>
    request(SpeakerLinksRecoveryResponse, `/api/events/${encodeURIComponent(slug)}/speaker-links`, {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  saveCfpDraft: (slug: string, token: string | null, body: CfpDraftRequest) =>
    request(
      CfpDraftResponse,
      token
        ? `/api/events/${encodeURIComponent(slug)}/drafts/${encodeURIComponent(token)}`
        : `/api/events/${encodeURIComponent(slug)}/drafts`,
      { method: token ? "PUT" : "POST", body: JSON.stringify(body) },
    ),

  cfpDraft: (slug: string, token: string) =>
    request(
      CfpDraftResponse,
      `/api/events/${encodeURIComponent(slug)}/drafts/${encodeURIComponent(token)}`,
    ),

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

  airtableStatus: () =>
    request(AirtableMirrorStatusResponse, "/api/airtable/status", undefined, {
      auth: true,
    }),

  agenda: (slug: string) =>
    request(OrganizerAgendaResponse, `/api/events/${encodeURIComponent(slug)}/agenda`, undefined, {
      auth: true,
    }),

  publishAgenda: (slug: string) =>
    request(
      PublishAgendaResponse,
      `/api/events/${encodeURIComponent(slug)}/agenda/publish`,
      { method: "POST" },
      { auth: true },
    ),

  createDirectSession: (slug: string, body: CreateDirectSessionRequest) =>
    request(
      CreateDirectSessionResponse,
      `/api/events/${encodeURIComponent(slug)}/sessions`,
      { method: "POST", body: JSON.stringify(body) },
      { auth: true },
    ),

  updateSession: (slug: string, sessionId: string, body: UpdateSessionRequest) =>
    request(
      z.object({ session: OrganizerSession }),
      `/api/events/${encodeURIComponent(slug)}/sessions/${encodeURIComponent(sessionId)}`,
      { method: "PATCH", body: JSON.stringify(body) },
      { auth: true },
    ),

  sessionVersions: (slug: string, sessionId: string) =>
    request(
      SessionVersionsResponse,
      `/api/events/${encodeURIComponent(slug)}/sessions/${encodeURIComponent(sessionId)}/versions`,
      undefined,
      { auth: true },
    ),

  restoreSessionVersion: (slug: string, sessionId: string, versionId: string) =>
    request(
      z.object({ session: OrganizerSession }),
      `/api/events/${encodeURIComponent(slug)}/sessions/${encodeURIComponent(sessionId)}/versions/${encodeURIComponent(versionId)}/restore`,
      { method: "POST" },
      { auth: true },
    ),

  updateSessionContentApproval: (slug: string, sessionId: string, body: SessionContentApprovalRequest) =>
    request(
      z.object({ session: OrganizerSession }),
      `/api/events/${encodeURIComponent(slug)}/sessions/${encodeURIComponent(sessionId)}/content-approval`,
      { method: "PATCH", body: JSON.stringify(body) },
      { auth: true },
    ),

  placeSession: (slug: string, sessionId: string, body: AgendaSlotRequest) =>
    request(
      OrganizerAgendaResponse,
      `/api/events/${encodeURIComponent(slug)}/sessions/${encodeURIComponent(sessionId)}/slot`,
      { method: "PUT", body: JSON.stringify(body) },
      { auth: true },
    ),

  communicationPreview: (slug: string, speakerId: string, kind: CommunicationKind) => {
    const query = new URLSearchParams({ speakerId, kind });
    return request(
      CommunicationPreviewResponse,
      `/api/events/${encodeURIComponent(slug)}/communications/preview?${query.toString()}`,
      undefined,
      { auth: true },
    );
  },

  outbox: (slug: string) => request(OutboxResponse, `/api/events/${encodeURIComponent(slug)}/communications`, undefined, { auth: true }),

  feedbackDraft: (slug: string, submissionId: string, body: FeedbackDraftRequest) =>
    request(
      FeedbackDraftResponse,
      `/api/events/${encodeURIComponent(slug)}/submissions/${encodeURIComponent(submissionId)}/feedback-draft`,
      { method: "POST", body: JSON.stringify(body) },
      { auth: true },
    ),

  scheduleNoticeDraft: (slug: string, sessionId: string, body: ScheduleNoticeDraftRequest) =>
    request(
      ScheduleNoticeDraftResponse,
      `/api/events/${encodeURIComponent(slug)}/sessions/${encodeURIComponent(sessionId)}/schedule-notice-draft`,
      { method: "POST", body: JSON.stringify(body) },
      { auth: true },
    ),

  simulateCommunication: (slug: string, body: SimulateCommunicationRequest) =>
    request(
      SimulateCommunicationResponse,
      `/api/events/${encodeURIComponent(slug)}/communications/simulate`,
      { method: "POST", body: JSON.stringify(body) },
      { auth: true },
    ),

  speakerPortal: (token: string) =>
    request(SpeakerPortalResponse, `/api/speaker-portal/${encodeURIComponent(token)}`),

  updateSpeakerProfile: (token: string, body: UpdateSpeakerProfileRequest) =>
    request(
      SpeakerPortalResponse,
      `/api/speaker-portal/${encodeURIComponent(token)}/profile`,
      { method: "PATCH", body: JSON.stringify(body) },
    ),

  updateSpeakerTask: (token: string, taskId: string, body: UpdateSpeakerTaskRequest) =>
    request(
      SpeakerPortalResponse,
      `/api/speaker-portal/${encodeURIComponent(token)}/tasks/${encodeURIComponent(taskId)}`,
      { method: "PUT", body: JSON.stringify(body) },
    ),

  updateSpeakerProposal: (token: string, submissionId: string, body: UpdateSpeakerProposalRequest) =>
    request(
      SpeakerPortalResponse,
      `/api/speaker-portal/${encodeURIComponent(token)}/proposals/${encodeURIComponent(submissionId)}`,
      { method: "PATCH", body: JSON.stringify(body) },
    ),

  evaluationWorkspace: (slug: string) =>
    request(EvaluationWorkspaceResponse, `/api/events/${encodeURIComponent(slug)}/evaluations`, undefined, { auth: true }),

  saveEvaluationRound: (slug: string, roundId: string | null, body: SaveEvaluationRoundRequest) =>
    request(
      EvaluationWorkspaceResponse,
      roundId
        ? `/api/events/${encodeURIComponent(slug)}/evaluations/rounds/${encodeURIComponent(roundId)}`
        : `/api/events/${encodeURIComponent(slug)}/evaluations/rounds`,
      { method: roundId ? "PUT" : "POST", body: JSON.stringify(body) },
      { auth: true },
    ),

  saveRoundReviewer: (slug: string, roundId: string, body: SaveRoundReviewerRequest) =>
    request(EvaluationWorkspaceResponse,
      `/api/events/${encodeURIComponent(slug)}/evaluations/rounds/${encodeURIComponent(roundId)}/reviewers`,
      { method: "PUT", body: JSON.stringify(body) }, { auth: true }),

  saveAssignments: (slug: string, roundId: string, body: SaveAssignmentsRequest) =>
    request(EvaluationWorkspaceResponse,
      `/api/events/${encodeURIComponent(slug)}/evaluations/rounds/${encodeURIComponent(roundId)}/assignments`,
      { method: "PUT", body: JSON.stringify(body) }, { auth: true }),

  autoDistributeAssignments: (slug: string, roundId: string) =>
    request(EvaluationWorkspaceResponse,
      `/api/events/${encodeURIComponent(slug)}/evaluations/rounds/${encodeURIComponent(roundId)}/auto-distribute`,
      { method: "POST" }, { auth: true }),

  nudgeReviewer: (slug: string, roundId: string, email: string) =>
    request(SimulateCommunicationResponse,
      `/api/events/${encodeURIComponent(slug)}/evaluations/rounds/${encodeURIComponent(roundId)}/reviewers/${encodeURIComponent(email)}/nudge`,
      { method: "POST" }, { auth: true }),

  reviewerQueue: (token: string) =>
    request(ReviewerQueueResponse, `/api/reviewer/${encodeURIComponent(token)}`),

  draftReviewScores: (token: string, roundId: string, submissionId: string) =>
    request(ReviewScoreDraftResponse,
      `/api/reviewer/${encodeURIComponent(token)}/rounds/${encodeURIComponent(roundId)}/submissions/${encodeURIComponent(submissionId)}/score-draft`,
      { method: "POST" }),

  submitReview: (token: string, roundId: string, submissionId: string, body: SubmitReviewRequest) =>
    request(ReviewerQueueResponse,
      `/api/reviewer/${encodeURIComponent(token)}/rounds/${encodeURIComponent(roundId)}/submissions/${encodeURIComponent(submissionId)}`,
      { method: "PUT", body: JSON.stringify(body) }),

  recuseReview: (token: string, roundId: string, submissionId: string) =>
    request(ReviewerQueueResponse,
      `/api/reviewer/${encodeURIComponent(token)}/rounds/${encodeURIComponent(roundId)}/submissions/${encodeURIComponent(submissionId)}/recuse`,
      { method: "POST" }),

  uploadSpeakerAsset: (token: string, file: File, kind: AssetKind, context?: { taskId?: string; sessionId?: string }) => {
    const form = new FormData();
    form.set("file", file);
    form.set("kind", kind);
    if (context?.taskId) form.set("taskId", context.taskId);
    if (context?.sessionId) form.set("sessionId", context.sessionId);
    return request(
      UploadAssetResponse,
      `/api/speaker-portal/${encodeURIComponent(token)}/assets`,
      { method: "POST", body: form },
    );
  },

  addSpeakerAssetComment: (token: string, assetId: string, body: CreateAssetCommentRequest) =>
    request(
      SpeakerPortalResponse,
      `/api/speaker-portal/${encodeURIComponent(token)}/assets/${encodeURIComponent(assetId)}/comments`,
      { method: "POST", body: JSON.stringify(body) },
    ),

  addOrganizerAssetComment: (slug: string, assetId: string, body: CreateAssetCommentRequest) =>
    request(
      AssetCommentResponse,
      `/api/events/${encodeURIComponent(slug)}/assets/${encodeURIComponent(assetId)}/comments`,
      { method: "POST", body: JSON.stringify(body) },
      { auth: true },
    ),

  /** Verifies a candidate passcode against the API without storing it first. */
  verifyPasscode: async (candidate: string): Promise<boolean> => {
    const res = await fetch("/api/admin/ping", {
      headers: { authorization: `Bearer ${candidate}` },
    });
    return res.status === 204;
  },
};
