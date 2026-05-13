import { describe, expect, it } from "vitest";
import {
  extractApprovedLinks,
  extractDocument,
  extractSitemapUrls,
  isSitemapIndex,
} from "@/lib/ingestion/sources/discovery";

describe("extractDocument — body extraction", () => {
  it("recovers paragraph text from <p>", () => {
    const html = `<html><head><title>Anima Christi</title></head><body><p>Soul of Christ, sanctify me.</p><p>Body of Christ, save me.</p></body></html>`;
    const doc = extractDocument(html);
    expect(doc.title).toBe("Anima Christi");
    expect(doc.bodyText).toContain("Soul of Christ, sanctify me");
    expect(doc.bodyText).toContain("Body of Christ, save me");
  });

  it("recovers text from <div> blocks when <p> is absent (modern CMS HTML)", () => {
    const html = `<html><body><div class="body-content"><div>Hallowed be thy name.</div><div>Thy kingdom come.</div></div></body></html>`;
    const doc = extractDocument(html);
    expect(doc.bodyText).toContain("Hallowed be thy name");
    expect(doc.bodyText).toContain("Thy kingdom come");
  });

  it("recovers text from <article>, <section>, <li>, <blockquote>, headings", () => {
    const html = `<html><body><article><h1>Heading</h1><section><p>Para</p></section><ul><li>Item one</li><li>Item two</li></ul><blockquote>A quote.</blockquote></article></body></html>`;
    const doc = extractDocument(html);
    expect(doc.bodyText).toContain("Heading");
    expect(doc.bodyText).toContain("Para");
    expect(doc.bodyText).toContain("Item one");
    expect(doc.bodyText).toContain("A quote");
  });

  it("strips <script>, <style>, <nav>, <header>, <footer>, <aside>, <form>, comments", () => {
    const html = `<html><body><nav>NAV LINKS</nav><header>HEADER</header><script>console.log('x')</script><style>.foo{}</style><!--comment--><p>Real body content here.</p><aside>ASIDE</aside><footer>FOOTER</footer><form>FORM</form></body></html>`;
    const doc = extractDocument(html);
    expect(doc.bodyText).toContain("Real body content here");
    expect(doc.bodyText).not.toMatch(/NAV LINKS|HEADER|FOOTER|ASIDE|FORM/);
    expect(doc.bodyText).not.toContain("console.log");
    expect(doc.bodyText).not.toContain("comment");
  });

  it("decodes HTML entities (&amp;, &nbsp;, numeric, hex)", () => {
    const html = `<html><body><p>Body &amp; Blood&nbsp;of&nbsp;Christ &#8212; &#x2014; salvation.</p></body></html>`;
    const doc = extractDocument(html);
    expect(doc.bodyText).toContain("Body & Blood of Christ");
    expect(doc.bodyText).toContain("—"); // both em-dashes decode to the same char
  });

  it("prefers og:description when no <meta description> tag is present", () => {
    const html = `<html><head><title>X</title><meta property="og:description" content="The Hail Mary, basic prayer."></head><body></body></html>`;
    const doc = extractDocument(html);
    expect(doc.description).toBe("The Hail Mary, basic prayer.");
  });

  it("falls back to whole-body text when no block tags match (last resort)", () => {
    const html = `<html><body>Plain text without any tags at all but should still be returned as body</body></html>`;
    const doc = extractDocument(html);
    expect(doc.bodyText.length).toBeGreaterThan(20);
  });
});

describe("extractApprovedLinks", () => {
  it("collects only allowlisted hosts and dedupes duplicates", () => {
    const html = `
      <a href="https://www.vatican.va/a">Vatican page A</a>
      <a href="https://www.vatican.va/a">Vatican page A (duplicate)</a>
      <a href="https://www.usccb.org/b">USCCB page B</a>
      <a href="https://example.com/bad">Off-allowlist</a>
    `;
    const links = extractApprovedLinks(html, "https://www.vatican.va/index.html");
    expect(links).toHaveLength(2);
    expect(links.map((l) => l.url)).toContain("https://www.vatican.va/a");
    expect(links.map((l) => l.url)).toContain("https://www.usccb.org/b");
  });

  it("resolves relative hrefs against the base URL", () => {
    const html = `<a href="/special/prayers">Prayers</a>`;
    const links = extractApprovedLinks(html, "https://www.vatican.va/index.html");
    expect(links[0].url).toBe("https://www.vatican.va/special/prayers");
  });
});

describe("extractSitemapUrls / isSitemapIndex", () => {
  it("extracts <loc> URLs from a urlset sitemap", () => {
    const xml = `<?xml version="1.0"?>
      <urlset>
        <url><loc>https://www.vatican.va/a</loc></url>
        <url><loc>https://www.usccb.org/b</loc></url>
        <url><loc>https://example.com/bad</loc></url>
      </urlset>`;
    const urls = extractSitemapUrls(xml);
    expect(urls).toContain("https://www.vatican.va/a");
    expect(urls).toContain("https://www.usccb.org/b");
    expect(urls).not.toContain("https://example.com/bad");
    expect(isSitemapIndex(xml)).toBe(false);
  });

  it("recognizes a sitemap-index document", () => {
    const xml = `<?xml version="1.0"?>
      <sitemapindex>
        <sitemap><loc>https://www.usccb.org/sitemap-prayers.xml</loc></sitemap>
        <sitemap><loc>https://www.usccb.org/sitemap-saints.xml</loc></sitemap>
      </sitemapindex>`;
    expect(isSitemapIndex(xml)).toBe(true);
    const urls = extractSitemapUrls(xml);
    expect(urls).toHaveLength(2);
  });

  it("returns an empty array when no <loc> entries are present", () => {
    expect(extractSitemapUrls("<urlset></urlset>")).toEqual([]);
  });
});
