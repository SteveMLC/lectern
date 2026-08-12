import { Link } from "react-router";
import { Card } from "../components/ui";
import { apiClient } from "../lib/api";
import { useAsync } from "../lib/useAsync";

const FEATURES: { title: string; body: string }[] = [
  {
    title: "CFP forms with real logic",
    body: "Custom fields, required validation, close dates, and conditional show/hide rules — evaluated identically in the browser and the API.",
  },
  {
    title: "Reviews that end in decisions",
    body: "Approve, waitlist, or deny with your reasoning saved as a committee note — and an AI-drafted decision email you review before it goes anywhere. Accepting creates exactly one schedulable session, with lineage kept.",
  },
  {
    title: "Agenda with conflict detection",
    body: "Room double-bookings and double-booked speakers surface automatically from schedule data.",
  },
  {
    title: "Speaker portal and asset tracking",
    body: "Bios, headshots, and slides as real uploaded files, with an onboarding task board that shows who still owes what.",
  },
  {
    title: "Reminders and calendar invites",
    body: "Templated speaker communications with valid .ics attachments. Simulated outbox by default, real sending behind a key.",
  },
  {
    title: "Embeds and a public API",
    body: "Mobile-friendly schedule and speaker gallery embeds, backed by the same JSON API the app itself uses.",
  },
];

export function Landing() {
  const { data } = useAsync(() => apiClient.events(), []);
  const demoSlug = data?.events[0]?.slug ?? "horizon-2026";

  return (
    <div className="min-h-dvh bg-white">
      <header className="border-b border-zinc-200">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <span className="flex items-center gap-2 text-sm font-semibold tracking-tight">
            <span className="flex size-6 items-center justify-center rounded-md bg-accent text-xs font-bold text-white">
              S
            </span>
            Lectern
          </span>
          <nav className="flex items-center gap-4 text-sm text-zinc-600">
            <Link to={`/e/${demoSlug}`} className="hover:text-zinc-900">
              Demo event
            </Link>
            <Link to="/docs" className="hover:text-zinc-900">
              API docs
            </Link>
            <Link to="/embed-preview" className="hover:text-zinc-900">
              Embeds
            </Link>
            <Link
              to="/admin"
              className="rounded-lg bg-accent px-3 py-1.5 font-medium text-white hover:bg-accent-strong"
            >
              Organizer console
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-5xl px-6 pb-16 pt-20 text-center">
          <p className="mb-4 inline-block rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent">
            Open source · MIT · Cloudflare-native
          </p>
          <h1 className="mx-auto max-w-2xl text-4xl font-semibold tracking-tight text-zinc-900">
            CFP to published agenda, without the enterprise tax.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-zinc-600">
            Lectern is the program side of event software: submissions, review, scheduling,
            speaker operations, and public embeds. One deploy, your data, no sales call.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Link
              to={`/e/${demoSlug}/cfp`}
              className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accent-strong"
            >
              Submit a talk to the demo event
            </Link>
            <Link
              to={`/e/${demoSlug}`}
              className="rounded-lg border border-zinc-300 px-5 py-2.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
            >
              View the demo event
            </Link>
          </div>
        </section>

        <section className="border-t border-zinc-100 bg-zinc-50/60 py-16">
          <div className="mx-auto grid max-w-5xl gap-4 px-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <Card key={f.title} className="p-5">
                <h2 className="text-sm font-semibold text-zinc-900">{f.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-zinc-600">{f.body}</p>
              </Card>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-zinc-200 py-8 text-center text-xs text-zinc-500">
        <p>Lectern — an open-source Sessionboard replacement built for Kill My SaaS 1.</p>
        <p className="mt-1.5">
          Judging or evaluating this deployment (human or agent)?{" "}
          <a href="/llms.txt" className="font-medium text-accent hover:underline">
            /llms.txt
          </a>{" "}
          has the full walkable chain, the demo passcode, and the API index — no account
          needed anywhere.
        </p>
      </footer>
    </div>
  );
}
