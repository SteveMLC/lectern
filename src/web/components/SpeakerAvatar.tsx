import { useState } from "react";
import { cn } from "./ui";

/**
 * A speaker's face, or a deterministic initials tile until they upload one.
 *
 * Headshots arrive through the speaker portal after acceptance — organizers
 * should not demand files from people they may decline — so every public
 * surface has to look finished with no photo present. Initials on a stable
 * per-speaker colour do that, and the tile swaps to the real photo the moment
 * it lands.
 */

const TILE_COLORS = [
  "bg-indigo-100 text-indigo-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-800",
  "bg-rose-100 text-rose-700",
  "bg-sky-100 text-sky-700",
  "bg-violet-100 text-violet-700",
];

/** Stable per-speaker colour: same name always gets the same tile. */
function colorFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return TILE_COLORS[hash % TILE_COLORS.length]!;
}

export function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase();
}

export function SpeakerAvatar({
  name,
  headshotUrl,
  size = "md",
  className,
}: {
  name: string;
  headshotUrl?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  // A record can outlive its object (a wiped bucket, a half-run seed). Falling
  // back to initials keeps that a non-event instead of a broken image.
  const [imageFailed, setImageFailed] = useState(false);
  const dimensions = size === "sm" ? "size-9 text-xs" : size === "lg" ? "size-20 text-xl" : "size-12 text-sm";

  if (headshotUrl && !imageFailed) {
    return (
      <img
        src={headshotUrl}
        alt={`${name} headshot`}
        loading="lazy"
        onError={() => setImageFailed(true)}
        className={cn("shrink-0 rounded-full bg-zinc-100 object-cover", dimensions, className)}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-semibold",
        dimensions,
        colorFor(name),
        className,
      )}
    >
      {initialsFor(name)}
    </span>
  );
}
