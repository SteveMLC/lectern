/**
 * Worker bindings and configuration. Secrets are set via `.dev.vars` locally
 * and `wrangler secret put` in production — never in wrangler.jsonc vars and
 * never shipped to the browser bundle.
 */
export interface Env {
  DB: D1Database;
  BUCKET: R2Bucket;
  ASSETS: Fetcher;
  /** "d1" (default) or "airtable" once the Airtable adapter is wired (Lane D). */
  DATA_BACKEND?: string;
  /** Secret. Required for every /api organizer route. */
  ORGANIZER_PASSCODE?: string;
  /** Secrets for the Airtable boundary (unused until Lane D wires it). */
  AIRTABLE_TOKEN?: string;
  AIRTABLE_BASE_ID?: string;
}
