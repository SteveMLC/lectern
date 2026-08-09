import { useState } from "react";
import { Link, NavLink, Outlet, useOutletContext } from "react-router";
import { Button, Card, ErrorBanner, Input, Spinner, cn } from "../../components/ui";
import { apiClient, clearPasscode, getPasscode, setPasscode } from "../../lib/api";
import { useAsync } from "../../lib/useAsync";

export interface AdminContext {
  eventSlug: string;
  eventName: string;
}

export function useAdminContext(): AdminContext {
  return useOutletContext<AdminContext>();
}

const NAV = [
  { to: "/admin", label: "Dashboard", end: true },
  { to: "/admin/submissions", label: "Submissions", end: false },
  { to: "/admin/reviews", label: "Reviews", end: false },
  { to: "/admin/agenda", label: "Agenda", end: false },
  { to: "/admin/speakers", label: "Speakers", end: false },
  { to: "/admin/communications", label: "Communications", end: false },
  { to: "/admin/resources", label: "Resources", end: false },
  { to: "/admin/integrations", label: "Integrations", end: false },
];

export function AdminLayout() {
  const [unlocked, setUnlocked] = useState(() => getPasscode() !== null);
  if (!unlocked) return <PasscodeGate onUnlocked={() => setUnlocked(true)} />;
  return <AdminShell onLock={() => setUnlocked(false)} />;
}

function AdminShell({ onLock }: { onLock: () => void }) {
  const { data, error, loading } = useAsync(() => apiClient.events(), []);
  const [navOpen, setNavOpen] = useState(false);

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner label="Loading console" />
      </div>
    );
  }
  const event = data?.events[0];
  if (error || !event) {
    return (
      <div className="mx-auto max-w-xl px-6 py-20">
        <ErrorBanner
          message={
            error?.message ??
            "No events in the database. Run `pnpm db:seed:local` (or :remote) and reload."
          }
        />
      </div>
    );
  }

  const ctx: AdminContext = { eventSlug: event.slug, eventName: event.name };

  return (
    <div className="min-h-dvh bg-zinc-50 lg:flex">
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2 text-sm font-semibold tracking-tight">
            <span className="flex size-6 items-center justify-center rounded-md bg-accent text-xs font-bold text-white">
              S
            </span>
            SpeakerOps
          </Link>
          <button
            type="button"
            onClick={() => setNavOpen((open) => !open)}
            className="inline-flex size-9 items-center justify-center rounded-lg border border-zinc-200 text-zinc-700"
            aria-expanded={navOpen}
            aria-label="Toggle organizer navigation"
          >
            <span className="flex flex-col gap-1">
              <span
                className={cn("block h-0.5 w-4 rounded bg-current", navOpen && "rotate-45")}
              />
              <span className={cn("block h-0.5 w-4 rounded bg-current", navOpen && "hidden")} />
              <span
                className={cn(
                  "block h-0.5 w-4 rounded bg-current",
                  navOpen && "-mt-1.5 -rotate-45",
                )}
              />
            </span>
          </button>
        </div>
        {navOpen ? (
          <div className="mt-3">
            <AdminNav onNavigate={() => setNavOpen(false)} />
            <AdminFooter
              eventSlug={event.slug}
              onLock={() => {
                setNavOpen(false);
                clearPasscode();
                onLock();
              }}
            />
          </div>
        ) : null}
      </header>

      <aside className="hidden w-64 shrink-0 flex-col border-r border-zinc-200 bg-white lg:sticky lg:top-0 lg:flex lg:h-dvh">
        <div className="border-b border-zinc-200 px-5 py-4">
          <Link to="/" className="flex items-center gap-2 text-sm font-semibold tracking-tight">
            <span className="flex size-6 items-center justify-center rounded-md bg-accent text-xs font-bold text-white">
              S
            </span>
            SpeakerOps
          </Link>
          <p className="mt-2 truncate text-xs text-zinc-500" title={event.name}>
            {event.name}
          </p>
        </div>
        <AdminNav />
        <AdminFooter
          eventSlug={event.slug}
          onLock={() => {
            clearPasscode();
            onLock();
          }}
        />
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <Outlet context={ctx} />
      </main>
    </div>
  );
}

function AdminNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
      {NAV.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              "block rounded-lg px-3 py-2 text-sm font-medium",
              isActive
                ? "bg-accent-soft text-accent"
                : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
            )
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}

function AdminFooter({ eventSlug, onLock }: { eventSlug: string; onLock: () => void }) {
  return (
    <div className="space-y-2 border-t border-zinc-200 p-4">
      <Link
        to={`/e/${eventSlug}`}
        className="block text-xs font-medium text-zinc-500 hover:text-zinc-800"
      >
        View public event page →
      </Link>
      <button
        type="button"
        onClick={onLock}
        className="text-xs font-medium text-zinc-400 hover:text-rose-600"
      >
        Lock console
      </button>
    </div>
  );
}

function PasscodeGate({ onUnlocked }: { onUnlocked: () => void }) {
  const [candidate, setCandidate] = useState("");
  const [checking, setChecking] = useState(false);
  const [failed, setFailed] = useState(false);

  async function unlock(e: React.FormEvent) {
    e.preventDefault();
    if (!candidate) return;
    setChecking(true);
    setFailed(false);
    const ok = await apiClient.verifyPasscode(candidate);
    setChecking(false);
    if (!ok) {
      setFailed(true);
      return;
    }
    setPasscode(candidate);
    onUnlocked();
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-zinc-50 px-6">
      <Card className="w-full max-w-sm p-8">
        <div className="mb-6 text-center">
          <span className="mx-auto mb-3 flex size-10 items-center justify-center rounded-xl bg-accent text-sm font-bold text-white">
            S
          </span>
          <h1 className="text-lg font-semibold text-zinc-900">Organizer console</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Enter the organizer passcode to continue.
          </p>
        </div>
        <form onSubmit={unlock} className="space-y-3">
          <Input
            type="password"
            value={candidate}
            onChange={(e) => setCandidate(e.target.value)}
            placeholder="Passcode"
            autoFocus
            aria-label="Organizer passcode"
          />
          {failed ? (
            <p className="text-xs font-medium text-rose-600">That passcode is not right.</p>
          ) : null}
          <Button type="submit" className="w-full" disabled={checking || !candidate}>
            {checking ? "Checking…" : "Unlock"}
          </Button>
        </form>
        <p className="mt-4 text-center text-xs text-zinc-400">
          The passcode is held in this tab only and never stored in the app bundle.
        </p>
      </Card>
    </div>
  );
}
