import type {
  EventBundle,
  EventCounts,
  EventSummary,
  OrganizerAgendaResponse,
  OrganizerSession,
  PublicScheduleResponse,
  PublicSessionsResponse,
  PublicSpeakersResponse,
  Speaker,
  SpeakerAsset,
  SubmissionListItem,
} from "../../../shared/contracts";
import type {
  CreateCfpSubmissionInput,
  CreateSpeakerAssetInput,
  CreateDirectSessionInput,
  DecideSubmissionInput,
  SpeakerPortalBundle,
  SpeakerOpsRepo,
  SimulateCommunicationInput,
  SubmissionDecisionResult,
  UpsertAgendaSlotInput,
  UpdateSpeakerProfileInput,
  UpdateSpeakerTaskInput,
} from "../types";

/**
 * Airtable persistence boundary — compiling stub.
 *
 * Lane D wires this against the planned base shape below so the organizer's
 * live operational record sits in Airtable while D1 stays the demo-reliable
 * fallback (DATA_BACKEND env flag switches).
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
      `AirtableRepo.${method} is not wired yet (Lane D). ` +
        `Run with DATA_BACKEND=d1 until the Airtable adapter lands.`,
    );
    this.name = "AirtableNotWiredError";
  }
}

export interface AirtableConfig {
  token: string;
  baseId: string;
}

export class AirtableRepo implements SpeakerOpsRepo {
  constructor(private readonly cfg: AirtableConfig) {}

  /** Real HTTP shell the wired methods will share. Public so Lane D tests can hit it directly. */
  async airtableFetch(path: string, init?: RequestInit): Promise<Response> {
    return fetch(`https://api.airtable.com/v0/${this.cfg.baseId}/${encodeURIComponent(path)}`, {
      ...init,
      headers: {
        authorization: `Bearer ${this.cfg.token}`,
        "content-type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
  }

  async health(): Promise<boolean> {
    throw new AirtableNotWiredError("health");
  }

  async listEvents(): Promise<EventSummary[]> {
    throw new AirtableNotWiredError("listEvents");
  }

  async getEventBySlug(_slug: string): Promise<EventBundle | null> {
    throw new AirtableNotWiredError("getEventBySlug");
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

  async createCfpSubmission(_input: CreateCfpSubmissionInput): Promise<SubmissionListItem> {
    throw new AirtableNotWiredError("createCfpSubmission");
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

  async upsertAgendaSlot(_input: UpsertAgendaSlotInput): Promise<OrganizerAgendaResponse> {
    throw new AirtableNotWiredError("upsertAgendaSlot");
  }

  async countsForEvent(_eventId: string): Promise<EventCounts> {
    throw new AirtableNotWiredError("countsForEvent");
  }

  async getSpeakerById(_id: string): Promise<Speaker | null> {
    throw new AirtableNotWiredError("getSpeakerById");
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

  async simulateCommunication(_input: SimulateCommunicationInput): Promise<void> {
    throw new AirtableNotWiredError("simulateCommunication");
  }

  async createSpeakerAsset(_input: CreateSpeakerAssetInput): Promise<SpeakerAsset> {
    throw new AirtableNotWiredError("createSpeakerAsset");
  }

  async getSpeakerAssetById(_id: string): Promise<SpeakerAsset | null> {
    throw new AirtableNotWiredError("getSpeakerAssetById");
  }
}
