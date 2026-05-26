/**
 * Structured source reader (spec §7). Verifies that the HTML parser
 * produces blocks the extractors can consume — and rejects
 * navigation / footer / ads / cookie banners.
 */

import { describe, expect, it } from "vitest";

import { parseStructuredBlocks } from "@/lib/admin-worker/structured-source-reader";

describe("parseStructuredBlocks — HTML structure parsing (spec §7)", () => {
  it("extracts title, canonical URL, and meta description", () => {
    const html = `
      <html>
        <head>
          <title>Hail Mary Prayer</title>
          <link rel="canonical" href="https://example.org/prayers/hail-mary" />
          <meta name="description" content="The Hail Mary prayer text and history." />
        </head>
        <body><p>Hail Mary, full of grace.</p></body>
      </html>
    `;
    const out = parseStructuredBlocks(html);
    expect(out.title).toBe("Hail Mary Prayer");
    expect(out.canonicalUrl).toBe("https://example.org/prayers/hail-mary");
    expect(out.metaDescription).toContain("Hail Mary");
  });

  it("extracts headings with their level", () => {
    const html = `
      <html><body>
        <h1>How to Pray the Rosary</h1>
        <h2>The Joyful Mysteries</h2>
        <h3>The Annunciation</h3>
      </body></html>
    `;
    const out = parseStructuredBlocks(html);
    const headings = out.blocks.filter((b) => b.blockType === "HEADING");
    expect(headings.length).toBe(3);
    expect(headings[0].headingLevel).toBe(1);
    expect(headings[1].text).toContain("Joyful");
    expect(headings[2].headingLevel).toBe(3);
  });

  it("extracts paragraph blocks", () => {
    const html = `
      <html><body>
        <p>The Rosary is a prayer of meditation on the life of Jesus Christ.</p>
        <p>It is prayed by Catholics around the world every day.</p>
      </body></html>
    `;
    const out = parseStructuredBlocks(html);
    const paras = out.blocks.filter((b) => b.blockType === "PARAGRAPH");
    expect(paras.length).toBe(2);
  });

  it("classifies an Amen-ending paragraph as a PRAYER block", () => {
    const html = `<p>Hail Mary, full of grace, the Lord is with thee. Amen.</p>`;
    const out = parseStructuredBlocks(html);
    expect(out.blocks.some((b) => b.blockType === "PRAYER")).toBe(true);
  });

  it("classifies a day-NNN paragraph as a DAY_SECTION block", () => {
    const html = `<p>Day 1 — O blessed Saint Jude, faithful apostle and martyr, pray for us.</p>`;
    const out = parseStructuredBlocks(html);
    expect(out.blocks.some((b) => b.blockType === "DAY_SECTION")).toBe(true);
  });

  it("strips <nav>, <footer>, and <aside> entirely", () => {
    const html = `
      <html><body>
        <nav>Home About Donate Login</nav>
        <main><p>Actual content here for testing.</p></main>
        <aside>Sidebar links you should ignore</aside>
        <footer>Copyright 2024 example.org</footer>
      </body></html>
    `;
    const out = parseStructuredBlocks(html);
    expect(out.blocks.some((b) => /Donate Login/.test(b.text))).toBe(false);
    expect(out.blocks.some((b) => /Copyright/.test(b.text))).toBe(false);
    expect(out.blocks.some((b) => /Sidebar links/.test(b.text))).toBe(false);
    expect(out.blocks.some((b) => b.text.includes("Actual content"))).toBe(true);
  });

  it("rejects newsletter / donation / social-share prompts in body text", () => {
    const html = `
      <html><body>
        <p>Real content paragraph about the saint.</p>
        <p>Sign up for our newsletter to get weekly updates.</p>
        <p>Share this on Facebook</p>
      </body></html>
    `;
    const out = parseStructuredBlocks(html);
    expect(out.rejectedBlocks.length).toBeGreaterThan(0);
    expect(out.rejectedBlocks.some((b) => b.rejectionReason === "newsletter prompt")).toBe(true);
    expect(out.rejectedBlocks.some((b) => b.rejectionReason === "social share")).toBe(true);
  });

  it("extracts scripture references from the body", () => {
    const html = `<p>As Saint Paul writes in Romans 8:28, all things work together for good.</p>`;
    const out = parseStructuredBlocks(html);
    expect(out.scriptureReferences.length).toBeGreaterThan(0);
    expect(out.scriptureReferences.some((s) => s.includes("Romans 8:28"))).toBe(true);
  });

  it("extracts <li> blocks", () => {
    const html = `
      <html><body><ul>
        <li>The Annunciation</li>
        <li>The Visitation</li>
        <li>The Nativity</li>
      </ul></body></html>
    `;
    const out = parseStructuredBlocks(html);
    const lis = out.blocks.filter((b) => b.blockType === "LIST_ITEM");
    expect(lis.length).toBe(3);
  });

  it("extracts tables as pipe-separated rows", () => {
    const html = `
      <table>
        <tr><th>Day</th><th>Mystery</th></tr>
        <tr><td>Monday</td><td>Joyful</td></tr>
        <tr><td>Tuesday</td><td>Sorrowful</td></tr>
      </table>
    `;
    const out = parseStructuredBlocks(html);
    const tables = out.blocks.filter((b) => b.blockType === "TABLE");
    expect(tables.length).toBe(1);
    expect(tables[0].text).toContain("Monday");
    expect(tables[0].text).toContain("|");
  });

  it("produces mainBodyText concatenating non-rejected paragraph + prayer blocks", () => {
    const html = `
      <p>The Hail Mary is one of the most beloved Catholic prayers.</p>
      <p>Hail Mary, full of grace. Amen.</p>
    `;
    const out = parseStructuredBlocks(html);
    expect(out.mainBodyText).toContain("Hail Mary");
    expect(out.mainBodyText.length).toBeGreaterThan(20);
  });
});
