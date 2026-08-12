import type {
  EventBundle,
  EventCounts,
  EventSummary,
  EvaluationWorkspaceResponse,
  OrganizerAgendaResponse,
  OrganizerSession,
  SessionVersion,
  PublicScheduleResponse,
  PublicSessionsResponse,
  PublicSpeakersResponse,
  OrganizerSpeakersResponse,
  Speaker,
  SpeakerAsset,
  AssetComment,
  ReviewerQueueResponse,
  OutboxMessage,
  SubmissionListItem,
  CfpDraftRequest,
  TaskDefinition,
} from "../../../shared/contracts";
import type {
  CreateCfpSubmissionInput,
  CreateSpeakerAssetInput,
  CreateDirectSessionInput,
  DecideSubmissionInput,
  SpeakerPortalBundle,
  LecternRepo,
  SimulateCommunicationInput,
  SubmissionDecisionResult,
  UpdateSessionInput,
  RestoreSessionVersionInput,
  UpdateSessionContentApprovalInput,
  UpsertAgendaSlotInput,
  UpdateSpeakerProfileInput,
  UpdateSpeakerTaskInput,
  UpdateSpeakerProposalInput,
  SaveEvaluationRoundInput,
  SaveRoundReviewerInput,
  SaveAssignmentsInput,
  SubmitReviewerScorecardInput,
  CreateEventInput,
  UpdateEventSettingsInput,
  CreateTrackInput,
  CreateRoomInput,
  CreateFormFieldInput,
  SaveCfpDraftInput,
  CreateOrganizerSpeakerInput,
  UpdateOrganizerSpeakerInput,
  ImportOrganizerSpeakersInput,
  CreateSpeakerTaskInput,
  BulkTaskReminderInput,
  CreateAssetCommentInput,
} from "../types";
import { createEmailDelivery, type EmailDelivery } from "../../integrations/emailDelivery";

/**
 * Airtable persistence proof adapter.
 *
 * Events/Speakers reads and simulated Message writes are live. Other methods
 * fail loudly while D1 remains the demo-reliable full backend.
 *
 * Non-negotiables for the real implementation:
 * - RATE LIMIT: Airtable allows 5 requests/second per base. Cache reads
 *   (per-isolate map + KV) and batch writes (10 records per request max),
 *   or a judge clicking quickly during live judging WILL hit 429s.
 * - Secrets (AIRTABLE_TOKEN) come from worker env only; never client-side.
 * - Store Airtable record ids in external_id_map so retries update instead
 *   of duplicating rows.
 */

export const AIRTABLE_TABLES = {
  events: "Events",
  tracks: "Tracks",
  rooms: "Rooms",
  speakers: "Speakers",
  submissions: "Submissions",
  reviews: "Reviews",
  sessions: "Sessions",
  agenda: "Agenda",
  tasks: "Tasks",
  messages: "Messages",
} as const;

export class AirtableNotWiredError extends Error {
  constructor(method: string) {
    super(
      `AirtableRepo.${method} is outside the proof adapter. ` +
        `Run with DATA_BACKEND=d1 for the complete application.`,
    );
    this.name = "AirtableNotWiredError";
  }
}

export interface AirtableConfig {
  token: string;
  baseId: string;
  /** Test seams; production uses the Worker globals. */
  fetcher?: typeof fetch;
  clock?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
}

interface AirtableListResponse {
  records: AirtableRecord[];
  offset?: string;
}

function requiredString(fields: Record<string, unknown>, name: string): string {
  const value = fields[name];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Airtable field "${name}" must be a non-empty string.`);
  }
  return value;
}

function nullableString(fields: Record<string, unknown>, name: string): string | null {
  const value = fields[name];
  return typeof value === "string" && value.trim() ? value : null;
}

export class AirtableRepo implements LecternRepo {
  private readonly fetcher: typeof fetch;
  private readonly clock: () => number;
  private readonly sleep: (ms: number) => Promise<void>;
  private requestTail: Promise<unknown> = Promise.resolve();
  private lastRequestAt = Number.NEGATIVE_INFINITY;
  private readonly cache = new Map<string, { expiresAt: number; records: AirtableRecord[] }>();

  constructor(
    private readonly cfg: AirtableConfig,
    private readonly emailDelivery: EmailDelivery = createEmailDelivery({}),
  ) {
    this.fetcher = cfg.fetcher ?? globalThis.fetch.bind(globalThis);
    this.clock = cfg.clock ?? Date.now;
    this.sleep = cfg.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  private schedule<T>(operation: () => Promise<T>): Promise<T> {
    const scheduled = this.requestTail.then(async () => {
      const waitMs = Math.max(0, this.lastRequestAt + 210 - this.clock());
      if (waitMs > 0) await this.sleep(waitMs);
      this.lastRequestAt = this.clock();
      return operation();
    });
    this.requestTail = scheduled.then(
      () => undefined,
      () => undefined,
    );
    return scheduled;
  }

  /** Rate-limited HTTP boundary. Retries 429s and never exceeds 5 starts/sec per isolate. */
  async airtableFetch(
    table: string,
    init?: RequestInit,
    query?: Record<string, string>,
  ): Promise<Response> {
    const url = new URL(
      `https://api.airtable.com/v0/${encodeURIComponent(this.cfg.baseId)}/${encodeURIComponent(table)}`,
    );
    for (const [key, value] of Object.entries(query ?? {})) url.searchParams.set(key, value);

    const run = (attempt: number): Promise<Response> =>
      this.schedule(() =>
        this.fetcher(url, {
          ...init,
          headers: {
            authorization: `Bearer ${this.cfg.token}`,
            "content-type": "application/json",
            ...(init?.headers ?? {}),
          },
        }),
      ).then(async (response) => {
        if (response.status !== 429 || attempt >= 2) return response;
        const retrySeconds = Number(response.headers.get("retry-after") ?? "1");
        await this.sleep(Number.isFinite(retrySeconds) ? retrySeconds * 1000 : 1000);
        return run(attempt + 1);
      });
    return run(0);
  }

  private async readTable(table: string): Promise<AirtableRecord[]> {
    const cached = this.cache.get(table);
    if (cached && cached.expiresAt > this.clock()) return cached.records;

    const response = await this.airtableFetch(table, undefined, { pageSize: "100" });
    if (!response.ok) {
      throw new Error(`Airtable ${table} read failed (${response.status}): ${await response.text()}`);
    }
    const body = (await response.json()) as AirtableListResponse;
    if (body.offset) {
      throw new Error(`Airtable ${table} has more than 100 records; pagination is not wired for the proof adapter.`);
    }
    this.cache.set(table, { expiresAt: this.clock() + 15_000, records: body.records });
    return body.records;
  }

  async health(): Promise<boolean> {
    try {
      await this.readTable(AIRTABLE_TABLES.events);
      return true;
    } catch {
      return false;
    }
  }

  async listEvents(): Promise<EventSummary[]> {
    const records = await this.readTable(AIRTABLE_TABLES.events);
    return records.map(({ fields }) => ({
      id: requiredString(fields, "SpeakerOps ID"),
      slug: requiredString(fields, "Slug"),
      name: requiredString(fields, "Name"),
      tagline: nullableString(fields, "Tagline"),
      startsOn: requiredString(fields, "Starts On"),
      endsOn: requiredString(fields, "Ends On"),
      timezone: requiredString(fields, "Timezone"),
    }));
  }

  async getEventBySlug(slug: string): Promise<EventBundle | null> {
    const records = await this.readTable(AIRTABLE_TABLES.events);
    const record = records.find((item) => item.fields.Slug === slug);
    if (!record) return null;
    const fields = record.fields;
    return {
      event: {
        id: requiredString(fields, "SpeakerOps ID"),
        slug: requiredString(fields, "Slug"),
        name: requiredString(fields, "Name"),
        tagline: nullableString(fields, "Tagline"),
        description: nullableString(fields, "Description"),
        startsOn: requiredString(fields, "Starts On"),
        endsOn: requiredString(fields, "Ends On"),
        timezone: requiredString(fields, "Timezone"),
        venue: nullableString(fields, "Venue"),
        websiteUrl: nullableString(fields, "Website URL"),
        agendaPublishedAt: nullableString(fields, "Agenda Published At"),
        createdAt: requiredString(fields, "Created At"),
        updatedAt: requiredString(fields, "Updated At"),
      },
      tracks: [],
      rooms: [],
      cfp: null,
    };
  }

  async getPublicSchedule(_slug: string): Promise<PublicScheduleResponse | null> {
    throw new AirtableNotWiredError("getPublicSchedule");
  }

  async getPublicSessions(_slug: string): Promise<PublicSessionsResponse | null> {
    throw new AirtableNotWiredError("getPublicSessions");
  }

  async getPublicSpeakers(_slug: string): Promise<PublicSpeakersResponse | null> {
    throw new AirtableNotWiredError("getPublicSpeakers");
  }

  async getOrganizerSpeakers(_eventId: string): Promise<OrganizerSpeakersResponse["speakers"]> {
    throw new AirtableNotWiredError("getOrganizerSpeakers");
  }

  async createOrganizerSpeaker(_input: CreateOrganizerSpeakerInput): Promise<Speaker> {
    throw new AirtableNotWiredError("createOrganizerSpeaker");
  }

  async updateOrganizerSpeaker(_input: UpdateOrganizerSpeakerInput): Promise<Speaker> {
    throw new AirtableNotWiredError("updateOrganizerSpeaker");
  }

  async importOrganizerSpeakers(_input: ImportOrganizerSpeakersInput): Promise<{ imported: number; updated: number; total: number }> {
    throw new AirtableNotWiredError("importOrganizerSpeakers");
  }

  async createSpeakerTask(_input: CreateSpeakerTaskInput): Promise<{ definition: TaskDefinition; assigned: number }> {
    throw new AirtableNotWiredError("createSpeakerTask");
  }

  async updateSpeakerTaskDueDate(_eventId: string, _definitionId: string, _dueAt: string | null): Promise<TaskDefinition> {
    throw new AirtableNotWiredError("updateSpeakerTaskDueDate");
  }

  async sendBulkTaskReminders(_input: BulkTaskReminderInput): Promise<{ queued: number; recipientEmails: string[] }> {
    throw new AirtableNotWiredError("sendBulkTaskReminders");
  }

  async createEvent(_input: CreateEventInput): Promise<EventBundle> { throw new AirtableNotWiredError("createEvent"); }
  async updateEventSettings(_input: UpdateEventSettingsInput): Promise<EventBundle> { throw new AirtableNotWiredError("updateEventSettings"); }
  async createTrack(_input: CreateTrackInput): Promise<EventBundle> { throw new AirtableNotWiredError("createTrack"); }
  async createRoom(_input: CreateRoomInput): Promise<EventBundle> { throw new AirtableNotWiredError("createRoom"); }
  async createFormField(_input: CreateFormFieldInput): Promise<EventBundle> { throw new AirtableNotWiredError("createFormField"); }

  async createCfpSubmission(_input: CreateCfpSubmissionInput): Promise<SubmissionListItem> {
    throw new AirtableNotWiredError("createCfpSubmission");
  }

  async saveCfpDraft(_input: SaveCfpDraftInput): Promise<{ token: string; savedAt: string; draft: CfpDraftRequest }> {
    throw new AirtableNotWiredError("saveCfpDraft");
  }

  async getCfpDraft(_eventId: string, _token: string): Promise<{ token: string; savedAt: string; draft: CfpDraftRequest } | null> {
    throw new AirtableNotWiredError("getCfpDraft");
  }

  async listSubmissions(_eventId: string): Promise<SubmissionListItem[]> {
    throw new AirtableNotWiredError("listSubmissions");
  }

  async getSubmissionById(_id: string): Promise<SubmissionListItem | null> {
    throw new AirtableNotWiredError("getSubmissionById");
  }

  async decideSubmission(_input: DecideSubmissionInput): Promise<SubmissionDecisionResult> {
    throw new AirtableNotWiredError("decideSubmission");
  }

  async getOrganizerAgenda(_eventId: string): Promise<OrganizerAgendaResponse> {
    throw new AirtableNotWiredError("getOrganizerAgenda");
  }

  async createDirectSession(_input: CreateDirectSessionInput): Promise<OrganizerSession> {
    throw new AirtableNotWiredError("createDirectSession");
  }

  async updateSession(_input: UpdateSessionInput): Promise<OrganizerSession> {
    throw new AirtableNotWiredError("updateSession");
  }

  async listSessionVersions(_eventId: string, _sessionId: string): Promise<SessionVersion[]> {
    throw new AirtableNotWiredError("listSessionVersions");
  }

  async restoreSessionVersion(_input: RestoreSessionVersionInput): Promise<OrganizerSession> {
    throw new AirtableNotWiredError("restoreSessionVersion");
  }

  async updateSessionContentApproval(_input: UpdateSessionContentApprovalInput): Promise<OrganizerSession> {
    throw new AirtableNotWiredError("updateSessionContentApproval");
  }

  async upsertAgendaSlot(_input: UpsertAgendaSlotInput): Promise<OrganizerAgendaResponse> {
    throw new AirtableNotWiredError("upsertAgendaSlot");
  }

  async publishAgenda(_eventId: string, _now: string): Promise<string> {
    throw new AirtableNotWiredError("publishAgenda");
  }

  async countsForEvent(_eventId: string): Promise<EventCounts> {
    throw new AirtableNotWiredError("countsForEvent");
  }

  async getSpeakerById(id: string): Promise<Speaker | null> {
    const records = await this.readTable(AIRTABLE_TABLES.speakers);
    const record = records.find((item) => item.fields["SpeakerOps ID"] === id);
    if (!record) return null;
    const fields = record.fields;
    const socials = fields.Socials;
    return {
      id: requiredString(fields, "SpeakerOps ID"),
      eventId: requiredString(fields, "Event ID"),
      email: requiredString(fields, "Email"),
      name: requiredString(fields, "Name"),
      company: nullableString(fields, "Company"),
      title: nullableString(fields, "Title"),
      bio: nullableString(fields, "Bio"),
      location: nullableString(fields, "Location"),
      workflowStatus: "invited",
      logisticsNotes: null,
      socials:
        typeof socials === "string" && socials.trim()
          ? (JSON.parse(socials) as Speaker["socials"])
          : null,
      createdAt: requiredString(fields, "Created At"),
      updatedAt: requiredString(fields, "Updated At"),
    };
  }

  async getSpeakerPortalByToken(_token: string): Promise<SpeakerPortalBundle | null> {
    throw new AirtableNotWiredError("getSpeakerPortalByToken");
  }

  async updateSpeakerProfile(_input: UpdateSpeakerProfileInput): Promise<SpeakerPortalBundle> {
    throw new AirtableNotWiredError("updateSpeakerProfile");
  }

  async updateSpeakerTask(_input: UpdateSpeakerTaskInput): Promise<SpeakerPortalBundle> {
    throw new AirtableNotWiredError("updateSpeakerTask");
  }

  async updateSpeakerProposal(_input: UpdateSpeakerProposalInput): Promise<SpeakerPortalBundle> {
    throw new AirtableNotWiredError("updateSpeakerProposal");
  }

  async getEvaluationWorkspace(_eventId: string): Promise<EvaluationWorkspaceResponse> {
    throw new AirtableNotWiredError("getEvaluationWorkspace");
  }

  async saveEvaluationRound(_input: SaveEvaluationRoundInput): Promise<void> {
    throw new AirtableNotWiredError("saveEvaluationRound");
  }

  async saveRoundReviewer(_input: SaveRoundReviewerInput): Promise<void> {
    throw new AirtableNotWiredError("saveRoundReviewer");
  }

  async saveAssignments(_input: SaveAssignmentsInput): Promise<void> {
    throw new AirtableNotWiredError("saveAssignments");
  }

  async autoDistributeAssignments(_roundId: string, _now: string): Promise<void> {
    throw new AirtableNotWiredError("autoDistributeAssignments");
  }

  async getReviewerQueue(_token: string): Promise<ReviewerQueueResponse | null> {
    throw new AirtableNotWiredError("getReviewerQueue");
  }

  async submitReviewerScorecard(_input: SubmitReviewerScorecardInput): Promise<void> {
    throw new AirtableNotWiredError("submitReviewerScorecard");
  }

  async simulateCommunication(input: SimulateCommunicationInput) {
    const delivery = await this.emailDelivery.send({
      messageId: input.messageId,
      toEmail: input.toEmail,
      subject: input.subject,
      bodyMd: input.bodyMd,
    });
    const response = await this.airtableFetch(AIRTABLE_TABLES.messages, {
      method: "POST",
      body: JSON.stringify({
        typecast: true,
        records: [
          {
            fields: {
              "SpeakerOps ID": input.messageId,
              "Event ID": input.eventId,
              "Speaker ID": input.speakerId,
              "To Email": input.toEmail,
              Subject: input.subject,
              "Body Markdown": input.bodyMd,
              Status: delivery.messageStatus,
              "Created At": input.now,
              "Delivery Attempt ID": input.attemptId,
              "Delivery Mode": delivery.mode,
              "Delivery Status": delivery.status,
              "Delivery Provider ID": delivery.providerId,
              "Delivery Error": delivery.error,
              "Delivered At": delivery.status === "success" ? input.now : null,
            },
          },
        ],
      }),
    });
    if (!response.ok) {
      throw new Error(`Airtable Messages write failed (${response.status}): ${await response.text()}`);
    }
    this.cache.delete(AIRTABLE_TABLES.messages);
    return delivery;
  }

  async queueDueTaskReminders(_now: string, _dueBefore: string): Promise<{ queued: number; taskIds: string[] }> {
    throw new AirtableNotWiredError("queueDueTaskReminders");
  }

  async listMessages(_eventId: string): Promise<OutboxMessage[]> {
    throw new AirtableNotWiredError("listMessages");
  }

  async createSpeakerAsset(_input: CreateSpeakerAssetInput): Promise<SpeakerAsset> {
    throw new AirtableNotWiredError("createSpeakerAsset");
  }

  async getSpeakerAssetById(_id: string): Promise<SpeakerAsset | null> {
    throw new AirtableNotWiredError("getSpeakerAssetById");
  }

  async createAssetComment(_input: CreateAssetCommentInput): Promise<AssetComment> {
    throw new AirtableNotWiredError("createAssetComment");
  }
}
