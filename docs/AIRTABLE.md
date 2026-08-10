# Airtable proof adapter

SpeakerOps keeps D1 as the complete, reliable demo backend. The Airtable adapter proves one operational workflow end to end: it reads the event and speaker from Airtable, then writes a simulated speaker communication to the Messages table.

## Required base schema

Create three tables. Field names are exact and case-sensitive.

### Events

| Field | Airtable type | Required |
| --- | --- | --- |
| SpeakerOps ID | Single line text (primary is fine) | Yes |
| Slug | Single line text | Yes |
| Name | Single line text | Yes |
| Tagline | Long text | No |
| Description | Long text | No |
| Starts On | Date, ISO format | Yes |
| Ends On | Date, ISO format | Yes |
| Timezone | Single line text | Yes |
| Venue | Single line text | No |
| Website URL | URL | No |
| Created At | Date with time | Yes |
| Updated At | Date with time | Yes |

### Speakers

| Field | Airtable type | Required |
| --- | --- | --- |
| SpeakerOps ID | Single line text (primary is fine) | Yes |
| Event ID | Single line text | Yes |
| Email | Email | Yes |
| Name | Single line text | Yes |
| Company | Single line text | No |
| Title | Single line text | No |
| Bio | Long text | No |
| Location | Single line text | No |
| Socials | Long text containing a JSON object | No |
| Created At | Date with time | Yes |
| Updated At | Date with time | Yes |

### Messages

| Field | Airtable type | Required |
| --- | --- | --- |
| SpeakerOps ID | Single line text (primary is fine) | Yes |
| Event ID | Single line text | Yes |
| Speaker ID | Single line text | Yes |
| To Email | Email | Yes |
| Subject | Single line text | Yes |
| Body Markdown | Long text | Yes |
| Status | Single select containing `sent_simulated` | Yes |
| Created At | Date with time | Yes |
| Delivery Attempt ID | Single line text | Yes |
| Delivery Mode | Single select containing `simulated` | Yes |
| Delivery Status | Single select containing `success` | Yes |
| Delivered At | Date with time | Yes |

## Credentials and switch

Create an Airtable personal access token with `data.records:read` and `data.records:write` access to this base. Set Worker secrets without committing them:

```sh
pnpm exec wrangler secret put AIRTABLE_TOKEN
pnpm exec wrangler secret put AIRTABLE_BASE_ID
```

For a local proof, add both values to `.dev.vars`, temporarily set `DATA_BACKEND` to `airtable`, and start the Worker. `/api/health` should report `dataBackend: "airtable"`. The communication simulate endpoint then reads Events and Speakers and writes Messages. Set `DATA_BACKEND` back to `d1` for the full demo.

## Reliability boundaries

- Every request is serialized with at least 210 ms between starts, keeping the adapter below Airtable's 5 requests/second per-base limit.
- HTTP 429 responses honor `Retry-After` and retry twice.
- Reads are cached per Worker isolate for 15 seconds.
- Writes are batched in Airtable's `records` shape (the proof writes one record; the API supports up to ten).
- The adapter fails loudly if the proof tables exceed 100 records because pagination is intentionally outside the hackathon proof.
- D1 remains the default and complete backend. Unwired Airtable repository methods throw a clear error instead of silently serving partial data.

Automated coverage lives in `src/worker/repo/airtable/airtableRepo.test.ts` and verifies the read/write shape, cache behavior, request spacing, and 429 retry.
