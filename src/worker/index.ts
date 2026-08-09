import { Hono } from "hono";
import type { Env } from "./env";
import { errorResponse } from "./lib/http";
import { api } from "./routes/api";

/**
 * One Worker serves everything:
 *  - /api/*  -> Hono JSON API
 *  - all other GET/HEAD -> static assets; unknown paths fall back to the SPA
 *    shell via the assets binding's single-page-application handling.
 */
const app = new Hono<{ Bindings: Env }>();

app.route("/api", api);

// Unmatched /api paths get JSON 404s, never the SPA shell.
app.all("/api/*", () => errorResponse(404, "not_found", "No such API route."));

app.on(["GET", "HEAD"], "*", (c) => c.env.ASSETS.fetch(c.req.raw));

app.all("*", () => errorResponse(405, "method_not_allowed", "Method not allowed."));

app.onError((err, _c) => {
  console.error("worker error:", err);
  return errorResponse(500, "internal", "Internal error.");
});

export default app;
