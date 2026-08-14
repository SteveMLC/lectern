import { Hono } from "hono";
import type { Env } from "./env";
import { errorResponse } from "./lib/http";
import { airtableApi } from "./routes/airtable";
import { api } from "./routes/api";
import { demoApi } from "./routes/demo";
import { demoPage } from "./routes/demoPage";
import { llms } from "./routes/llms";
import { createRepo } from "./repo/factory";
import { DRAFT_REMINDER_WINDOW_MS } from "../shared/domain/draftReminders";

/**
 * One Worker serves everything:
 *  - /api/*  -> Hono JSON API
 *  - /demo   -> server-rendered operator page for loading demo datasets
 *  - all other GET/HEAD -> static assets; unknown paths fall back to the SPA
 *    shell via the assets binding's single-page-application handling.
 */
const app = new Hono<{ Bindings: Env }>();

app.route("/api/demo", demoApi);
app.route("/api/airtable", airtableApi);
app.route("/api", api);
app.route("/", demoPage);
app.route("/", llms);

// Unmatched /api paths get JSON 404s, never the SPA shell.
app.all("/api/*", () => errorResponse(404, "not_found", "No such API route."));

app.on(["GET", "HEAD"], "*", (c) => c.env.ASSETS.fetch(c.req.raw));

app.all("*", () => errorResponse(405, "method_not_allowed", "Method not allowed."));

app.onError((err, _c) => {
  console.error("worker error:", err);
  return errorResponse(500, "internal", "Internal error.");
});

export default {
  fetch: app.fetch,
  scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    const now = new Date();
    const dueBefore = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    const closesBefore = new Date(now.getTime() + DRAFT_REMINDER_WINDOW_MS);
    const repo = createRepo(env);
    ctx.waitUntil(
      repo
        .queueDueTaskReminders(now.toISOString(), dueBefore.toISOString())
        .then((result) => console.log(`automatic task reminders queued: ${result.queued}`)),
    );
    ctx.waitUntil(
      repo
        .queueDraftCloseReminders(now.toISOString(), closesBefore.toISOString())
        .then((result) => console.log(`draft close reminders queued: ${result.queued}`)),
    );
  },
};
