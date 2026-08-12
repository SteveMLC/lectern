import type { Env } from "../env";
import { AirtableRepo } from "./airtable/airtableRepo";
import { D1Repo } from "./d1/d1Repo";
import type { SpeakerOpsRepo } from "./types";
import { createEmailDelivery } from "../integrations/emailDelivery";

/**
 * Single place the backend is chosen. Handlers never know which store they
 * are talking to. D1 is the default and the always-works demo fallback.
 */
export function createRepo(env: Env): SpeakerOpsRepo {
  const emailDelivery = createEmailDelivery(env);
  if (env.DATA_BACKEND === "airtable") {
    if (!env.AIRTABLE_TOKEN || !env.AIRTABLE_BASE_ID) {
      throw new Error(
        "DATA_BACKEND=airtable requires AIRTABLE_TOKEN and AIRTABLE_BASE_ID secrets.",
      );
    }
    return new AirtableRepo({ token: env.AIRTABLE_TOKEN, baseId: env.AIRTABLE_BASE_ID }, emailDelivery);
  }
  return new D1Repo(env.DB, emailDelivery);
}
