/**
 * HTML source parser (spec #5/#7).
 *
 * The parser runs BEFORE recordSourceDocument's cleanSourceBody pass.
 * It extracts structured fields from raw HTML — title, meta
 * description, canonical URL, og:title, og:type, headings, body
 * paragraphs, list items — and strips elements that never contribute
 * body text (script / style / nav / footer / header / aside / form /
 * iframe / noscript). It also drops blocks whose text matches noisy
 * phrases (donate / subscribe / newsletter / livestream / register /
 * share / related articles / upcoming events / cookie /
 * advertisement).
 */

import { describe, expect, it } from "vitest";
import { parseHtmlForSourceDocument } from "@/lib/content-factory/html-parser";

describe("parseHtmlForSourceDocument", () => {
  it("extracts title, description, canonical, og:title, schema:type", () => {
    const html = `
<!doctype html>
<html>
<head>
  <title>Divine Mercy Novena — Day 1</title>
  <meta name="description" content="The first day of the Divine Mercy Novena prayer." />
  <link rel="canonical" href="https://example.org/novenas/divine-mercy/day-1" />
  <meta property="og:title" content="Divine Mercy Novena Day 1" />
  <meta property="og:type" content="article" />
</head>
<body>
  <main>
    <h1>Divine Mercy Novena — Day 1</h1>
    <p>Begin with the sign of the cross.</p>
  </main>
</body>
</html>
    `.trim();
    const parsed = parseHtmlForSourceDocument({
      html,
      sourceUrl: "https://example.org/novenas/divine-mercy/day-1",
    });
    expect(parsed.title).toBe("Divine Mercy Novena — Day 1");
    expect(parsed.description).toBe("The first day of the Divine Mercy Novena prayer.");
    expect(parsed.canonicalUrl).toBe("https://example.org/novenas/divine-mercy/day-1");
    expect(parsed.ogTitle).toBe("Divine Mercy Novena Day 1");
    expect(parsed.schemaType).toBe("article");
    expect(parsed.headings).toContainEqual({ level: 1, text: "Divine Mercy Novena — Day 1" });
    expect(parsed.paragraphs).toContain("Begin with the sign of the cross.");
    expect(parsed.parserVersion).toBeTruthy();
  });

  it("strips script / style / nav / footer / header / aside / form / iframe / noscript", () => {
    const html = `
<html>
<head><title>Test</title></head>
<body>
  <header>navigation banner</header>
  <nav>menu menu menu</nav>
  <aside>related stuff</aside>
  <main>
    <h1>Real Content</h1>
    <p>Body text we want to keep.</p>
    <script>alert("evil")</script>
    <style>body { color: red }</style>
    <noscript>fallback that should not appear</noscript>
    <iframe src="ads"></iframe>
    <form><input/></form>
  </main>
  <footer>copyright stuff</footer>
</body>
</html>
    `.trim();
    const parsed = parseHtmlForSourceDocument({
      html,
      sourceUrl: "https://example.org/test",
    });
    expect(parsed.cleanedText).toContain("Body text we want to keep.");
    expect(parsed.cleanedText).not.toMatch(/navigation banner/);
    expect(parsed.cleanedText).not.toMatch(/copyright stuff/);
    expect(parsed.cleanedText).not.toMatch(/menu menu menu/);
    expect(parsed.cleanedText).not.toMatch(/alert\("evil"\)/);
    expect(parsed.cleanedText).not.toMatch(/fallback that should not appear/);
    expect(parsed.cleanedText).not.toMatch(/related stuff/);
  });

  it("drops blocks that match noisy donate / subscribe / livestream / register / cookie phrases", () => {
    const html = `
<html><body><main>
  <p>Donate now to support our mission!</p>
  <p>Subscribe to our newsletter for weekly updates.</p>
  <p>Watch live every Sunday at 11am.</p>
  <p>Register now for our upcoming retreat.</p>
  <p>Share this on Facebook!</p>
  <p>Related articles you might enjoy.</p>
  <p>Cookie preferences notice.</p>
  <p>The real content of the page is right here — a description of the devotion.</p>
</main></body></html>
    `.trim();
    const parsed = parseHtmlForSourceDocument({
      html,
      sourceUrl: "https://example.org/test",
    });
    expect(parsed.cleanedText).toContain("The real content of the page is right here");
    // Each noisy phrase is dropped at the block level.
    expect(parsed.cleanedText).not.toMatch(/Donate now to support/);
    expect(parsed.cleanedText).not.toMatch(/Subscribe to our newsletter/);
    expect(parsed.cleanedText).not.toMatch(/Watch live every Sunday/);
    expect(parsed.cleanedText).not.toMatch(/Register now for/);
    expect(parsed.cleanedText).not.toMatch(/Share this on Facebook/);
    expect(parsed.cleanedText).not.toMatch(/Related articles/);
    expect(parsed.cleanedText).not.toMatch(/Cookie preferences/);
  });

  it("prefers <main> over <article> over <body> for the content container", () => {
    const html = `
<html><body>
  <p>body-level paragraph (should NOT survive when main exists)</p>
  <main>
    <p>main paragraph kept</p>
  </main>
</body></html>
    `.trim();
    const parsed = parseHtmlForSourceDocument({
      html,
      sourceUrl: "https://example.org/test",
    });
    expect(parsed.paragraphs).toContain("main paragraph kept");
    expect(parsed.paragraphs).not.toContain("body-level paragraph (should NOT survive when main exists)");
  });

  it("emits empty cleanedText when there is no real content (router should treat as empty)", () => {
    const html = `<html><body><nav>nav only</nav><footer>footer only</footer></body></html>`;
    const parsed = parseHtmlForSourceDocument({
      html,
      sourceUrl: "https://example.org/test",
    });
    expect(parsed.cleanedText.length).toBeLessThan(20);
  });

  it("passes plain text through when input is not HTML", () => {
    const parsed = parseHtmlForSourceDocument({
      html: "Just some plain text content.",
      sourceUrl: "https://example.org/test",
    });
    expect(parsed.cleanedText).toBe("Just some plain text content.");
    expect(parsed.title).toBeNull();
  });
});
