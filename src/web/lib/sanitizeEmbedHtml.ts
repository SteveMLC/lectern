/**
 * Sanitizer for organizer-authored resource-page embeds.
 *
 * Resource pages carry an optional raw HTML block (venue maps, schedules from
 * other tools). The author is the organizer — trusted-ish — but this HTML is
 * rendered to every speaker, so it is treated as untrusted anyway, exactly as
 * the launch brief required.
 *
 * Strategy: parse with the browser's own parser (never regex on HTML), then
 * rebuild against a strict allowlist:
 * - Elements not on the list are removed entirely, including their contents —
 *   which is what kills <script>, <style>, <object>, <form> and friends.
 * - Attributes not on the per-tag list are dropped, which removes every
 *   on* handler and srcdoc.
 * - URL attributes must parse as http(s) (mailto also allowed on links), so
 *   javascript: and data: URLs cannot survive.
 * - iframes are force-sandboxed and lazy, whatever the author wrote.
 *
 * DOMParser does not execute scripts or fire network requests during parsing,
 * so parsing untrusted markup here is safe.
 */

const ALLOWED: Record<string, readonly string[]> = {
  iframe: ["src", "title", "width", "height", "allowfullscreen"],
  img: ["src", "alt", "width", "height"],
  a: ["href", "title"],
  p: [],
  br: [],
  hr: [],
  strong: [],
  em: [],
  b: [],
  i: [],
  ul: [],
  ol: [],
  li: [],
  h2: [],
  h3: [],
  h4: [],
  blockquote: [],
  code: [],
  pre: [],
  span: [],
  div: [],
  table: [],
  thead: [],
  tbody: [],
  tr: [],
  th: [],
  td: [],
};

const URL_ATTRIBUTES = new Set(["src", "href"]);

function urlIsSafe(value: string, tag: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return false; // relative or malformed — embeds must be absolute
  }
  if (parsed.protocol === "http:" || parsed.protocol === "https:") return true;
  return tag === "a" && parsed.protocol === "mailto:";
}

function scrubElement(element: Element): void {
  const tag = element.tagName.toLowerCase();
  const allowedAttributes = ALLOWED[tag] ?? [];

  for (const attribute of [...element.attributes]) {
    const name = attribute.name.toLowerCase();
    if (!allowedAttributes.includes(name)) {
      element.removeAttribute(attribute.name);
      continue;
    }
    if (URL_ATTRIBUTES.has(name) && !urlIsSafe(attribute.value, tag)) {
      element.removeAttribute(attribute.name);
    }
  }

  // An iframe whose src was rejected is an empty hole — drop it below via src check.
  if (tag === "iframe") {
    element.setAttribute("sandbox", "allow-scripts allow-same-origin allow-popups");
    element.setAttribute("referrerpolicy", "no-referrer");
    element.setAttribute("loading", "lazy");
  }
  if (tag === "img") {
    element.setAttribute("loading", "lazy");
  }
  if (tag === "a") {
    element.setAttribute("rel", "noopener noreferrer");
    element.setAttribute("target", "_blank");
  }
}

function walk(parent: Element): void {
  for (const child of [...parent.children]) {
    const tag = child.tagName.toLowerCase();
    if (!(tag in ALLOWED)) {
      // Removing the element removes its contents too — this is what kills
      // <script>, <style>, <object>, <form> and anything else off-list.
      child.remove();
      continue;
    }
    scrubElement(child);
    // A media element whose src failed the URL check is an empty hole — drop it.
    if ((tag === "iframe" || tag === "img") && !child.getAttribute("src")) {
      child.remove();
      continue;
    }
    walk(child);
  }
}

/** Returns markup safe to hand to dangerouslySetInnerHTML, or "" for nothing safe. */
export function sanitizeEmbedHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  walk(doc.body);
  return doc.body.innerHTML.trim();
}
