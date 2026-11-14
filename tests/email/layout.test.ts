import { describe, expect, it } from "vitest";
import {
  formatEmailCount,
  formatEmailDateTime,
  renderEmailHtml,
  renderEmailText,
  type EmailDocument,
} from "@/lib/email/layout";

const doc = (over: Partial<EmailDocument> = {}): EmailDocument => ({
  locale: "en",
  title: "Thank you!",
  preheader: "A preview line.",
  siteUrl: "https://etviafidei.com",
  blocks: [
    { type: "heading", text: "Thank you!" },
    { type: "paragraph", text: "First paragraph." },
    { type: "list", items: ["One", "Two"] },
    { type: "figures", rows: [{ label: "Saints", value: "3,752" }] },
    { type: "button", label: "Open", url: "https://etviafidei.com/x?a=1&b=2" },
    { type: "signature", lines: ["Blessings,", "The Via Fidei Team"] },
  ],
  footer: {
    link: { url: "https://etviafidei.com", label: "etviafidei.com" },
    copyright: "© 2026 Via Fidei. All rights reserved.",
  },
  ...over,
});

describe("email layout — what keeps it intact across inboxes", () => {
  const html = renderEmailHtml(doc());

  it("draws the logo as a hosted PNG with fixed dimensions, never inline SVG", () => {
    expect(html).not.toContain("<svg");
    expect(html).toMatch(
      /<img src="https:\/\/etviafidei\.com\/email\/crucifix-logo\.png" width="36" height="49" alt=""/,
    );
  });

  it("lays the paper grain over a solid paper colour so blocked images still leave paper", () => {
    expect(html).toContain('bgcolor="#fbf8f1"');
    expect(html).toContain(
      "background-color:#fbf8f1;background-image:url('https://etviafidei.com/email/paper-grain.png')",
    );
  });

  it("uses only six-digit hex colours, which Outlook for Windows understands", () => {
    expect(html).not.toMatch(/rgba?\(/);
  });

  it("keeps Outlook to a 600px column and declares a light colour scheme", () => {
    expect(html).toContain('<!--[if mso]><table role="presentation" align="center" width="600"');
    expect(html).toContain('<meta name="color-scheme" content="light">');
    // The whole button is the link in Outlook too: hidden em-spaces pad it there.
    expect(html).toContain("mso-padding-alt:0;");
    expect(html).toMatch(
      /<!--\[if mso\]><i style="mso-font-width:214%;mso-text-raise:22pt" hidden>&emsp;<\/i>/,
    );
  });

  it("tells screen readers the language and gives them real structure", () => {
    expect(html).toContain('<html lang="en" dir="ltr"');
    expect(html).toContain('role="article" aria-label="Thank you!"');
    expect(html).toMatch(/<h1 [^>]*>Thank you!<\/h1>/);
    expect(html).toMatch(/<ul [^>]*><li [^>]*>One<\/li><li [^>]*>Two<\/li><\/ul>/);
    expect(html).toMatch(/<th scope="row"[^>]*>Saints<\/th><td[^>]*>3,752<\/td>/);
  });

  it("closes with the site's address and the copyright notice, centered", () => {
    expect(html).toMatch(
      /<p class="vf-sans" align="center" [^>]*text-align:center;[^>]*><a href="https:\/\/etviafidei\.com"[^>]*>etviafidei\.com<\/a><\/p><p class="vf-sans" align="center" [^>]*>© 2026 Via Fidei\. All rights reserved\.<\/p>/,
    );
  });

  it("puts a link under the signature when one is given", () => {
    const signed = renderEmailHtml(
      doc({
        blocks: [
          {
            type: "signature",
            lines: ["Blessings,", "The Via Fidei Team"],
            link: { url: "https://etviafidei.com", label: "etviafidei.com" },
          },
        ],
      }),
    );
    expect(signed).toContain(
      'The Via Fidei Team<br><a href="https://etviafidei.com" target="_blank" style="color:#1f3a8a;text-decoration:underline;">etviafidei.com</a></p>',
    );
  });

  it("keeps decorative rules out of the screen reader's way", () => {
    expect(html).toContain('<table role="presentation" aria-hidden="true" width="100%"');
  });

  it("lets a data table's first column name each row", () => {
    const admin = renderEmailHtml(
      doc({
        blocks: [
          {
            type: "table",
            columns: [
              { key: "c", label: "Content" },
              { key: "a", label: "Added", align: "right" },
            ],
            rows: [{ c: "Prayer", a: "+5" }],
          },
        ],
      }),
    );
    expect(admin).toMatch(/<th scope="col"[^>]*>Content<\/th>/);
    expect(admin).toMatch(/<th scope="row"[^>]*>Prayer<\/th><td[^>]*>\+5<\/td>/);
  });

  it("wraps long links and paths instead of stretching the sheet, and keeps line breaks", () => {
    const long = renderEmailHtml(
      doc({ blocks: [{ type: "paragraph", text: "at a (x.ts:1)\nat b (y.ts:2)" }] }),
    );
    expect(long).toContain("word-break:break-word;overflow-wrap:anywhere;");
    expect(long).toContain("at a (x.ts:1)<br>at b (y.ts:2)");
  });

  it("hides the preview line from view and from screen readers", () => {
    expect(html).toMatch(
      /<div aria-hidden="true" style="display:none;[^"]*">A preview line\.<\/div>/,
    );
  });

  it("escapes every string it is given", () => {
    const evil = renderEmailHtml(
      doc({ blocks: [{ type: "paragraph", text: "<script>x</script>" }] }),
    );
    expect(evil).not.toContain("<script>x</script>");
    expect(evil).toContain("&lt;script&gt;x&lt;/script&gt;");
    expect(html).toContain('href="https://etviafidei.com/x?a=1&amp;b=2"');
  });

  it("marks Simplified Chinese as zh-Hans", () => {
    expect(renderEmailHtml(doc({ locale: "zh" }))).toContain('<html lang="zh-Hans"');
  });
});

describe("email layout — plain text copy", () => {
  it("carries every block, the button's URL and the footer link", () => {
    const text = renderEmailText(doc());
    expect(text).toContain("Thank you!");
    expect(text).toContain("  • One");
    expect(text).toMatch(/Saints\s+3,752/);
    expect(text).toContain("Open: https://etviafidei.com/x?a=1&b=2");
    expect(text).toContain("Blessings,\nThe Via Fidei Team");
    expect(
      text.trimEnd().endsWith("https://etviafidei.com\n© 2026 Via Fidei. All rights reserved."),
    ).toBe(true);
    expect(text).not.toMatch(/<[a-z]/i);
    // Rules made of "=" or "-" are read aloud character by character.
    expect(text).not.toMatch(/^[=-]{3,}$/m);
  });

  it("writes table rows as sentences that keep each number with its column", () => {
    const text = renderEmailText(
      doc({
        blocks: [
          {
            type: "table",
            columns: [
              { key: "c", label: "Content" },
              { key: "a", label: "Added" },
              { key: "d", label: "Deleted" },
            ],
            rows: [{ c: "Prayer", a: "+5", d: "0" }],
          },
        ],
      }),
    );
    expect(text).toContain("  Prayer — Added: +5, Deleted: 0");
  });
});

describe("email number and date formats", () => {
  it("groups thousands the way each language does", () => {
    expect(formatEmailCount(3752, "en")).toBe("3,752");
    expect(formatEmailCount(3752, "de")).toBe("3.752");
    expect(formatEmailCount(3752, "la")).toBe("3,752");
    expect(formatEmailCount(Number.NaN, "en")).toBe("0");
  });

  it("writes dates in the reader's language, and plainly for Latin", () => {
    const d = new Date("2099-01-01T12:00:00Z");
    expect(formatEmailDateTime(d, "en")).toContain("January 1, 2099");
    expect(formatEmailDateTime(d, "la")).toBe("2099-01-01 12:00 UTC");
  });
});
