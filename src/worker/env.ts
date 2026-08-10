/**
 * Worker bindings and configuration. Secrets are set via `.dev.vars` locally
 * and `wrangler secret put` in production — never in wrangler.jsonc vars and
 * never shipped to the browser bundle.
 */
export interface Env {
  DB: D1Database;
  BUCKET: R2Bucket;
  ASSETS: Fetcher;
  /** "d1" (default/full app) or "airtable" for the documented proof workflow. */
  DATA_BACKEND?: string;
  /** Secret. Required for every /api organizer route. */
  ORGANIZER_PASSCODE?: string;
  /** Secrets for the Airtable proof adapter; never exposed client-side. */
  AIRTABLE_TOKEN?: string;
  AIRTABLE_BASE_ID?: string;
  /** Secret. Enables AI-assisted decision-feedback drafting; template fallback without it. */
  ANTHROPIC_API_KEY?: string;
  /** Optional model override for feedback drafting (default claude-sonnet-5). */
  ANTHROPIC_MODEL?: string;
}
