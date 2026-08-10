import { describe, expect, it } from "vitest";
import {
  AIRTABLE_BATCH_LIMIT,
  batch,
  estimateRequests,
  mapSessionRow,
  mapSubmissionRow,
  mergePlans,
  planTable,
  type MirrorRow,
} from "./airtableMirror";

const rows = (...ids: string[]): MirrorRow[] =>
  ids.map((id) => ({ internalId: id, fields: { "SpeakerOps ID": id } }));

describe("planTable", () => {
  it("creates every row when nothing has been mirrored yet", () => {
    const plan = planTable("Speakers", rows("spk_a", "spk_b"), new Map());
    expect(plan.creates.map((c) => c.internalId)).toEqual(["spk_a", "spk_b"]);
    expect(plan.updates).toEqual([]);
    expect(plan.orphans).toEqual([]);
  });

  it("updates rows already mapped to an Airtable record", () => {
    const known = new Map([["spk_a", "recAAA"]]);
    const plan = planTable("Speakers", rows("spk_a", "spk_b"), known);
    expect(plan.updates).toEqual([
      {
        table: "Speakers",
        internalId: "spk_a",
        recordId: "recAAA",
        fields: { "SpeakerOps ID": "spk_a" },
      },
    ]);
    expect(plan.creates.map((c) => c.internalId)).toEqual(["spk_b"]);
  });

  it("is idempotent: a second sync of unchanged data creates nothing", () => {
    const known = new Map([
      ["spk_a", "recAAA"],
      ["spk_b", "recBBB"],
    ]);
    const plan = planTable("Speakers", rows("spk_a", "spk_b"), known);
    expect(plan.creates).toEqual([]);
    expect(plan.updates).toHaveLength(2);
  });

  it("reports records whose source row has been deleted", () => {
    const known = new Map([
      ["spk_a", "recAAA"],
      ["spk_gone", "recZZZ"],
    ]);
    const plan = planTable("Speakers", rows("spk_a"), known);
    expect(plan.orphans).toEqual([
      { table: "Speakers", internalId: "spk_gone", recordId: "recZZZ" },
    ]);
  });

  it("handles an empty source table without inventing work", () => {
    const plan = planTable("Speakers", [], new Map());
    expect(plan).toEqual({ creates: [], updates: [], orphans: [] });
  });
});

describe("batch", () => {
  it("never exceeds Airtable's 10-record write limit", () => {
    const items = Array.from({ length: 25 }, (_, i) => i);
    const batches = batch(items);
    expect(batches.map((b) => b.length)).toEqual([10, 10, 5]);
    expect(batches.every((b) => b.length <= AIRTABLE_BATCH_LIMIT)).toBe(true);
  });

  it("preserves order across batches", () => {
    expect(batch([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("returns nothing for an empty list", () => {
    expect(batch([])).toEqual([]);
  });

  it("rejects a nonsensical batch size", () => {
    expect(() => batch([1], 0)).toThrow(RangeError);
  });
});

describe("estimateRequests", () => {
  it("counts one request per batch per table per operation", () => {
    const plan = mergePlans([
      planTable("Speakers", rows(...Array.from({ length: 12 }, (_, i) => `spk_${i}`)), new Map()),
      planTable("Submissions", rows("sub_a"), new Map()),
    ]);
    // Speakers: 12 creates -> 2 requests. Submissions: 1 create -> 1 request.
    expect(estimateRequests(plan)).toBe(3);
  });

  it("counts creates and updates separately", () => {
    const plan = planTable("Speakers", rows("a", "b"), new Map([["a", "recA"]]));
    expect(estimateRequests(plan)).toBe(2);
  });

  it("is zero for an empty plan", () => {
    expect(estimateRequests({ creates: [], updates: [], orphans: [] })).toBe(0);
  });
});

describe("field mapping", () => {
  it("carries the submission/session distinction into the base", () => {
    const fromSubmission = mapSessionRow({
      id: "ses_1",
      title: "Accepted Talk",
      format: "talk",
      status: "confirmed",
      origin: "accepted_submission",
      source_submission_id: "sub_1",
      track_name: "AI",
      speaker_names: "Ada Okafor",
    });
    const direct = mapSessionRow({
      id: "ses_2",
      title: "Sponsor Keynote",
      format: "keynote",
      status: "confirmed",
      origin: "direct",
      source_submission_id: null,
      track_name: null,
      speaker_names: "Dana Whitfield",
    });

    expect(fromSubmission.fields["From Submission"]).toBe("sub_1");
    expect(fromSubmission.fields.Origin).toBe("accepted_submission");
    expect(direct.fields["From Submission"]).toBeNull();
    expect(direct.fields.Origin).toBe("direct");
  });

  it("always carries the SpeakerOps ID join key", () => {
    const row = mapSubmissionRow({
      id: "sub_9",
      title: "T",
      abstract: "A",
      status: "submitted",
      format: "talk",
      track_name: null,
      speaker_names: null,
      submitted_at: null,
    });
    expect(row.internalId).toBe("sub_9");
    expect(row.fields["SpeakerOps ID"]).toBe("sub_9");
  });

  it("normalises missing values to null rather than the string 'null'", () => {
    const row = mapSubmissionRow({
      id: "sub_9",
      title: "T",
      abstract: "A",
      status: "submitted",
      format: "talk",
      track_name: null,
      speaker_names: null,
      submitted_at: null,
    });
    expect(row.fields.Track).toBeNull();
    expect(row.fields["Submitted At"]).toBeNull();
  });
});
