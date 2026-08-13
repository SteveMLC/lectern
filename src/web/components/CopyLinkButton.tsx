import { useEffect, useRef, useState } from "react";

/**
 * Copies an app path as an absolute URL. Capability links are how everything
 * in Lectern is shared, so copying one is a first-class, one-click action.
 */
export function CopyLinkButton({ path, label = "Copy link", className = "" }: {
  path: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  async function copy() {
    const url = new URL(path, window.location.origin).toString();
    let ok = false;
    try {
      await navigator.clipboard.writeText(url);
      ok = true;
    } catch {
      // Older engines and stricter permission states: fall back to the
      // selection-based path, which works under any real user gesture.
      const scratch = document.createElement("textarea");
      scratch.value = url;
      scratch.setAttribute("readonly", "");
      scratch.style.position = "fixed";
      scratch.style.opacity = "0";
      document.body.appendChild(scratch);
      scratch.select();
      try { ok = document.execCommand("copy"); } catch { ok = false; }
      scratch.remove();
    }
    if (ok) {
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1600);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void copy()}
      aria-live="polite"
      className={`inline-flex items-center justify-center rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 ${copied ? "border-emerald-300 text-emerald-700" : ""} ${className}`}
    >
      {copied ? "Copied ✓" : label}
    </button>
  );
}
