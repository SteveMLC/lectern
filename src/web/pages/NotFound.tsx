import { Link } from "react-router";

export function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-sm font-semibold text-accent">404</p>
      <h1 className="text-2xl font-semibold text-zinc-900">Page not found</h1>
      <Link to="/" className="text-sm font-medium text-accent hover:underline">
        Back to Lectern
      </Link>
    </div>
  );
}
