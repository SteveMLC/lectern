import { Hono } from "hono";
import type { Env } from "../env";

/**
 * The /demo control page.
 *
 * Deliberately server-rendered and standalone rather than part of the React
 * SPA: it is an operator tool, not product surface, and keeping it out of the
 * app router means feature lanes and this page never collide.
 */
export const demoPage = new Hono<{ Bindings: Env }>();

const HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Demo data — SpeakerOps</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' rx='20' fill='%234f46e5'/%3E%3Ctext x='50' y='68' font-size='52' text-anchor='middle' fill='white' font-family='system-ui' font-weight='700'%3ES%3C/text%3E%3C/svg%3E">
<style>
  :root { --accent:#4f46e5; --accent-soft:#eef2ff; }
  * { box-sizing: border-box; }
  body { margin:0; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
         background:#fafafa; color:#18181b; -webkit-font-smoothing:antialiased; }
  .wrap { max-width: 760px; margin: 0 auto; padding: 48px 24px 80px; }
  a { color: var(--accent); }
  h1 { font-size: 22px; margin: 0 0 6px; letter-spacing:-.01em; }
  .sub { color:#71717a; font-size:14px; margin:0 0 28px; }
  .card { background:#fff; border:1px solid #e4e4e7; border-radius:12px; padding:20px; margin-bottom:16px;
          box-shadow: 0 1px 2px rgba(0,0,0,.04); }
  .row { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; flex-wrap:wrap; }
  .name { font-weight:600; font-size:15px; margin:0; }
  .meta { color:#71717a; font-size:13px; margin:4px 0 0; }
  .pill { display:inline-block; padding:2px 10px; border-radius:999px; font-size:12px; font-weight:500; }
  .on { background:#dcfce7; color:#166534; }
  .off { background:#f4f4f5; color:#52525b; }
  .stats { display:grid; grid-template-columns:repeat(auto-fit,minmax(96px,1fr)); gap:12px; margin-top:18px;
           padding-top:16px; border-top:1px solid #f4f4f5; }
  .stat b { display:block; font-size:19px; font-weight:600; }
  .stat span { font-size:12px; color:#71717a; }
  .actions { display:flex; gap:8px; margin-top:18px; flex-wrap:wrap; }
  button { font: inherit; font-size:14px; font-weight:500; padding:9px 16px; border-radius:8px; cursor:pointer;
           border:1px solid transparent; }
  button:disabled { opacity:.55; cursor:not-allowed; }
  .primary { background:var(--accent); color:#fff; }
  .primary:hover:not(:disabled) { background:#4338ca; }
  .secondary { background:#fff; color:#18181b; border-color:#d4d4d8; }
  .secondary:hover:not(:disabled) { background:#f4f4f5; }
  pre { background:#18181b; color:#e4e4e7; padding:14px 16px; border-radius:8px; font-size:12.5px;
        line-height:1.65; overflow-x:auto; margin:16px 0 0; white-space:pre-wrap; }
  input { font: inherit; font-size:14px; padding:9px 12px; border:1px solid #d4d4d8; border-radius:8px; width:100%; }
  .note { font-size:13px; color:#71717a; line-height:1.6; }
  .err { background:#fef2f2; border:1px solid #fecaca; color:#991b1b; padding:12px 14px; border-radius:8px;
         font-size:13.5px; margin-bottom:16px; }
  code { background:#f4f4f5; padding:1px 5px; border-radius:4px; font-size:12.5px; }
</style>
</head>
<body>
<div class="wrap">
  <h1>Demo data</h1>
  <p class="sub">Load a hand-authored conference from <code>demo-data/</code>, or reset it back to exactly what the files say.</p>
  <div id="root"></div>
</div>
<script>
const KEY = "speakerops.organizer.passcode";
const root = document.getElementById("root");
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[c]));

function headers() {
  return { authorization: "Bearer " + (sessionStorage.getItem(KEY) || "") };
}

function gate(message) {
  root.innerHTML =
    (message ? '<div class="err">' + esc(message) + "</div>" : "") +
    '<div class="card"><p class="name">Organizer passcode</p>' +
    '<p class="meta">Loading demo data changes the database, so this page is gated.</p>' +
    '<div style="margin-top:14px"><input id="pc" type="password" placeholder="Passcode" autofocus></div>' +
    '<div class="actions"><button class="primary" id="unlock">Unlock</button></div></div>';
  const go = async () => {
    const v = document.getElementById("pc").value;
    if (!v) return;
    const res = await fetch("/api/admin/ping", { headers: { authorization: "Bearer " + v } });
    if (res.status !== 204) return gate("That passcode is not right.");
    sessionStorage.setItem(KEY, v);
    load();
  };
  document.getElementById("unlock").onclick = go;
  document.getElementById("pc").onkeydown = (e) => { if (e.key === "Enter") go(); };
}

function render(datasets) {
  root.innerHTML = datasets.map((d) => {
    const c = d.counts;
    return '<div class="card">' +
      '<div class="row"><div><p class="name">' + esc(d.name) + '</p>' +
      '<p class="meta">' + esc(d.key) + '</p></div>' +
      '<span class="pill ' + (d.loaded ? "on" : "off") + '">' + (d.loaded ? "Loaded" : "Not loaded") + "</span></div>" +
      '<div class="stats">' +
      stat(c.speakers, "speakers") + stat(c.submissions, "submissions") + stat(c.sessions, "sessions") +
      stat(c.scheduled, "scheduled") + stat(c.conflicts, "conflicts") + stat(c.outstandingTasks, "open tasks") +
      "</div>" +
      '<div class="actions">' +
      '<button class="primary" data-act="load" data-key="' + esc(d.key) + '">' +
        (d.loaded ? "Reset to files" : "Load conference") + "</button>" +
      (d.loaded ? '<button class="secondary" data-act="view" data-slug="' + esc(d.slug) + '">View event</button>' +
                  '<button class="secondary" data-act="unload" data-key="' + esc(d.key) + '">Remove</button>' : "") +
      "</div><div id=\\"out-" + esc(d.key) + '"></div></div>';
  }).join("") +
  '<p class="note">Loading is idempotent — it deletes this conference and re-inserts it from the files, so ' +
  '<strong>Reset to files</strong> undoes anything typed into the app. The seeded demo event is separate and untouched. ' +
  "Edit the JSON in <code>demo-data/</code>, run <code>pnpm demo:check</code>, then press Load.</p>";

  root.querySelectorAll("button[data-act]").forEach((b) => { b.onclick = () => act(b); });
}

function stat(n, label) {
  return '<div class="stat"><b>' + n + "</b><span>" + label + "</span></div>";
}

async function act(button) {
  const action = button.dataset.act;
  if (action === "view") { window.location.href = "/e/" + button.dataset.slug; return; }

  const key = button.dataset.key;
  const out = document.getElementById("out-" + key);
  root.querySelectorAll("button").forEach((b) => (b.disabled = true));
  button.textContent = action === "load" ? "Loading…" : "Removing…";

  try {
    const res = await fetch("/api/demo/" + encodeURIComponent(key) + "/" + action, {
      method: "POST", headers: headers(),
    });
    const body = await res.json();
    if (!res.ok) {
      out.innerHTML = '<pre>' + esc(body?.error?.message || "Request failed.") + "</pre>";
    } else {
      out.innerHTML = "<pre>" + esc(body.report.join("\\n")) + "</pre>";
    }
  } catch (e) {
    out.innerHTML = "<pre>" + esc(String(e)) + "</pre>";
  }
  await load(out.innerHTML);
}

async function load(keepOutput) {
  if (!sessionStorage.getItem(KEY)) return gate();
  const res = await fetch("/api/demo/status", { headers: headers() });
  if (res.status === 401) { sessionStorage.removeItem(KEY); return gate("Session expired."); }
  const body = await res.json();
  if (!res.ok) {
    root.innerHTML = '<div class="err">' + esc(body?.error?.message || "Could not load demo status.") + "</div>";
    return;
  }
  render(body.datasets);
  if (keepOutput) {
    const first = root.querySelector('[id^="out-"]');
    if (first) first.innerHTML = keepOutput;
  }
}

load();
</script>
</body>
</html>`;

demoPage.get("/demo", (c) =>
  c.html(HTML, 200, { "cache-control": "no-store", "x-robots-tag": "noindex" }),
);
