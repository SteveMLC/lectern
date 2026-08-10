// @vitest-environment happy-dom
// @vitest-environment-options {"happyDOM": {"settings": {"disableIframePageLoading": true, "disableJavaScriptFileLoading": true, "disableCSSFileLoading": true}}}
import { describe, expect, it } from "vitest";
import { sanitizeEmbedHtml } from "./sanitizeEmbedHtml";

describe("sanitizeEmbedHtml", () => {
  it("keeps the seeded venue-map iframe working, with a forced sandbox", () => {
    const out = sanitizeEmbedHtml(
      '<iframe src="https://example.com/venue-map" title="Venue map" width="100%" height="360" loading="lazy"></iframe>',
    );
    expect(out).toContain('src="https://example.com/venue-map"');
    expect(out).toContain('title="Venue map"');
    expect(out).toContain('sandbox="allow-scripts allow-same-origin allow-popups"');
    expect(out).toContain('referrerpolicy="no-referrer"');
  });

  it("removes script elements and their contents entirely", () => {
    const out = sanitizeEmbedHtml('<p>before</p><script>document.title="owned"</script><p>after</p>');
    expect(out).toContain("before");
    expect(out).toContain("after");
    expect(out).not.toContain("script");
    expect(out).not.toContain("owned");
  });

  it("strips event-handler attributes", () => {
    const out = sanitizeEmbedHtml('<p onclick="steal()" onmouseover="also()">hello</p>');
    expect(out).toBe("<p>hello</p>");
  });

  it("rejects javascript: URLs on links but keeps the text", () => {
    const out = sanitizeEmbedHtml('<a href="javascript:alert(1)">click me</a>');
    expect(out).not.toContain("javascript:");
    expect(out).toContain("click me");
  });

  it("drops an iframe whose src is a javascript: or data: URL", () => {
    expect(sanitizeEmbedHtml('<iframe src="javascript:alert(1)"></iframe>')).toBe("");
    expect(sanitizeEmbedHtml('<iframe src="data:text/html,<script>1</script>"></iframe>')).toBe("");
  });

  it("drops srcdoc however it is written", () => {
    const out = sanitizeEmbedHtml(
      '<iframe src="https://example.com/x" srcdoc="<script>bad()</script>"></iframe>',
    );
    expect(out).not.toContain("srcdoc");
    expect(out).toContain('src="https://example.com/x"');
  });

  it("removes style/object/embed/form wholesale", () => {
    const out = sanitizeEmbedHtml(
      "<style>*{display:none}</style><object data='x'></object><embed src='x'><form action='https://evil.example'><input name='pw'></form><p>kept</p>",
    );
    expect(out).toBe("<p>kept</p>");
  });

  it("rejects data: image sources but keeps https ones", () => {
    expect(sanitizeEmbedHtml('<img src="data:image/svg+xml,<svg onload=1>" alt="x">')).toBe("");
    const ok = sanitizeEmbedHtml('<img src="https://example.com/map.png" alt="Map">');
    expect(ok).toContain('src="https://example.com/map.png"');
    expect(ok).toContain('loading="lazy"');
  });

  it("forces safe rel/target on links", () => {
    const out = sanitizeEmbedHtml('<a href="https://example.com/deck">slides</a>');
    expect(out).toContain('rel="noopener noreferrer"');
    expect(out).toContain('target="_blank"');
  });

  it("keeps ordinary formatting markup", () => {
    const input = "<h3>Getting there</h3><ul><li><strong>Train:</strong> Red line</li></ul>";
    expect(sanitizeEmbedHtml(input)).toBe(input);
  });

  it("sanitizes nested nasties inside allowed containers", () => {
    const out = sanitizeEmbedHtml('<div><p>fine</p><script>bad()</script><iframe src="ftp://x"></iframe></div>');
    expect(out).toBe("<div><p>fine</p></div>");
  });

  it("returns empty string when nothing survives", () => {
    expect(sanitizeEmbedHtml("<script>only()</script>")).toBe("");
  });
});
