/**
 * The journal's PDF button opens a print page.
 *
 * Its window.print() was an inline script, which the site's Content-Security-Policy
 * refuses, so no dialog ever opened. Its formatting split on blank lines and checked for
 * marks after escaping, so an entry saved through the form, with CRLF line endings, came
 * out as one heading, and a quote never rendered at all.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const requireUserMock = vi.fn();
const findUniqueMock = vi.fn();

vi.mock("@/lib/auth", () => ({
  requireUser: () => requireUserMock(),
}));
vi.mock("@/lib/db/client", () => ({
  prisma: { journalEntry: { findUnique: (...args: unknown[]) => findUniqueMock(...args) } },
}));
vi.mock("@/lib/i18n/server", async () => {
  const { createTranslator } = await import("@/lib/i18n/translator");
  return { getTranslator: async () => ({ t: createTranslator("es"), locale: "es" }) };
});

import { GET } from "@/app/api/journal/[id]/download/route";
import { renderJournalBody } from "@/app/api/journal/[id]/download/render-entry";

const ENTRY = {
  id: "entry-123456",
  userId: "u1",
  title: "Faith & Hope <b>",
  body: "A line",
  createdAt: new Date("2026-11-07T12:00:00Z"),
};

async function download(): Promise<Response> {
  const req = new Request("http://localhost/api/journal/entry-123456/download");
  return GET(req as unknown as NextRequest, { params: Promise.resolve({ id: "entry-123456" }) });
}

beforeEach(() => {
  requireUserMock.mockReset().mockResolvedValue({ id: "u1" });
  findUniqueMock.mockReset().mockResolvedValue(ENTRY);
});

describe("the print page", () => {
  it("has no inline script: its one script is a file of the site's own", async () => {
    const html = await (await download()).text();
    const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
    expect(scripts).toHaveLength(1);
    expect(scripts[0]![1]).toContain('src="/journal-print.js"');
    expect(scripts[0]![2]!.trim()).toBe("");
    // An event handler attribute is inline script as well.
    expect(html).not.toMatch(/\son[a-z]+=/i);
  });

  it("is backed by a file that really prints, and a button for after the dialog", async () => {
    const html = await (await download()).text();
    expect(html).toMatch(/<button type="button" id="print-entry">/);
    const script = readFileSync(join(process.cwd(), "public", "journal-print.js"), "utf8");
    expect(script).toContain('getElementById("print-entry")');
    expect(script.match(/window\.print\(\)/g)).toHaveLength(2);
    expect(script).toContain('addEventListener("load"');
  });

  it("speaks the reader's language", async () => {
    const html = await (await download()).text();
    expect(html).toContain('<html lang="es">');
    expect(html).toContain("Imprimir o guardar como PDF");
    // The word "Journal" here came from a key only English had, so a screen reader voiced
    // an English word with the page's Spanish voice.
    expect(html).toContain('<p class="meta">Via Fidei · Diario · ');
    expect(html).not.toContain("Journal ·");
  });

  it("wraps a long pasted link, rather than making a phone scroll sideways", async () => {
    const html = await (await download()).text();
    expect(html).toMatch(/body \{[^}]*overflow-wrap: anywhere/);
  });

  it("shows the title as typed, escaped", async () => {
    const html = await (await download()).text();
    expect(html).toContain("<title>Faith &amp; Hope &lt;b&gt;</title>");
    expect(html).toContain("<h1>Faith &amp; Hope &lt;b&gt;</h1>");
  });

  it("is private", async () => {
    const res = await download();
    expect(res.headers.get("cache-control")).toContain("no-store");
    expect(res.headers.get("content-type")).toContain("text/html");
  });

  it("sends a signed-out reader to log in, rather than a bare word in a new tab", async () => {
    requireUserMock.mockResolvedValue(null);
    const res = await download();
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("/login?next=/profile/journal");
  });

  it("serves only the reader's own entries", async () => {
    findUniqueMock.mockResolvedValue({ ...ENTRY, userId: "someone-else" });
    expect((await download()).status).toBe(404);
  });
});

describe("renderJournalBody", () => {
  it("formats an entry whose lines end in CRLF", () => {
    const html = renderJournalBody("## A heading\r\n\r\nA **bold** word.\r\n\r\n- one\r\n- two");
    expect(html).toContain("<h2>A heading</h2>");
    expect(html).toContain("<p>A <strong>bold</strong> word.</p>");
    expect(html).toContain("<ul><li>one</li><li>two</li></ul>");
    expect(html).not.toContain("\r");
    expect(html).not.toContain("**");
  });

  it("renders a quote", () => {
    expect(renderJournalBody("> Be still")).toBe("<blockquote>Be still</blockquote>");
    expect(renderJournalBody("> one\n> two")).toBe("<blockquote>one<br/>two</blockquote>");
  });

  // The toolbar puts a mark on its own line with a single newline before it.
  it("reads a mark at the start of any line, not only after a blank one", () => {
    const html = renderJournalBody("Before\n## Heading\nAfter\n- item\n> quote\nEnd");
    expect(html.split("\n")).toEqual([
      "<p>Before</p>",
      "<h2>Heading</h2>",
      "<p>After</p>",
      "<ul><li>item</li></ul>",
      "<blockquote>quote</blockquote>",
      "<p>End</p>",
    ]);
  });

  it("keeps two lists apart", () => {
    expect(renderJournalBody("- a\n1. b")).toBe(
      '<ul><li>a</li></ul>\n<ol style="padding-left:3ch"><li value="1">b</li></ol>',
    );
  });

  describe("a number at the start of a line", () => {
    const itemsOf = (html: string) =>
      [...html.matchAll(/<li(?: value="(\d+)")?>(.*?)<\/li>/g)].map((m) => [m[1], m[2]]);

    it("is kept as the reader typed it", () => {
      expect(
        itemsOf(renderJournalBody("23. The Lord is my shepherd\n51. Have mercy on me")),
      ).toEqual([
        ["23", "The Lord is my shepherd"],
        ["51", "Have mercy on me"],
      ]);
    });

    it("resumes a list after a paragraph at its own number, not at 1", () => {
      const html = renderJournalBody("1. one\n2. two\n\nA thought.\n\n3. three\n4. four");
      expect(itemsOf(html)).toEqual([
        ["1", "one"],
        ["2", "two"],
        ["3", "three"],
        ["4", "four"],
      ]);
      expect(html).toContain("<p>A thought.</p>");
    });

    // The toolbar can only ever write "1.", so a reader who pressed it three times means
    // one, two, three.
    it("counts up a list of nothing but 1s, which is the toolbar's", () => {
      expect(renderJournalBody("1. one\n1. two\n1. three")).toBe(
        '<ol style="padding-left:3ch"><li>one</li><li>two</li><li>three</li></ol>',
      );
    });

    it("makes a list item of a lone 1., the toolbar's mark", () => {
      expect(itemsOf(renderJournalBody("Before\n1. one\n\nAfter"))).toEqual([["1", "one"]]);
    });

    it("leaves a lone line with any other number as the sentence it is", () => {
      expect(renderJournalBody("1917. The year of Fatima was on my mind.")).toBe(
        "<p>1917. The year of Fatima was on my mind.</p>",
      );
      expect(renderJournalBody("A list resumed\n3. The third reason\nAnd on.")).toBe(
        "<p>A list resumed<br/>3. The third reason<br/>And on.</p>",
      );
    });

    it("leaves a number a list could not show as typed in the text", () => {
      expect(renderJournalBody("007. A leading zero\n008. Another")).toBe(
        "<p>007. A leading zero<br/>008. Another</p>",
      );
      expect(renderJournalBody("1234567890. Too long\n1234567891. For a list")).toBe(
        "<p>1234567890. Too long<br/>1234567891. For a list</p>",
      );
    });

    it("gives a long number room, so it does not hang off the page", () => {
      expect(renderJournalBody("1917. One\n2017. Two")).toContain('<ol style="padding-left:6ch">');
      expect(renderJournalBody("23. One\n51. Two")).toContain('<ol style="padding-left:4ch">');
      const hundred = Array.from({ length: 100 }, () => "1. x").join("\n");
      expect(renderJournalBody(hundred)).toContain('<ol style="padding-left:5ch">');
    });
  });

  it("keeps a line break within a paragraph, and a blank line between two", () => {
    expect(renderJournalBody("one\ntwo\n\nthree")).toBe("<p>one<br/>two</p>\n<p>three</p>");
  });

  it("formats within headings, list items and quotes too", () => {
    expect(renderJournalBody("## A **big** day")).toBe("<h2>A <strong>big</strong> day</h2>");
    expect(renderJournalBody("- _so_ good")).toBe("<ul><li><em>so</em> good</li></ul>");
    expect(renderJournalBody("> **yes**")).toBe("<blockquote><strong>yes</strong></blockquote>");
  });

  it("leaves underscores inside a word alone", () => {
    expect(renderJournalBody("my_file_name and _this_")).toBe(
      "<p>my_file_name and <em>this</em></p>",
    );
  });

  it("leaves the empty pairs the toolbar can insert as typed", () => {
    expect(renderJournalBody("**** and __")).toBe("<p>**** and __</p>");
  });

  it("escapes everything the reader typed, marks or no marks", () => {
    for (const text of [
      "<script>alert(1)</script>",
      '<img src=x onerror="alert(1)">',
      "**<script>alert(1)</script>**",
      "## <script>alert(1)</script>",
      "> <script>alert(1)</script>",
      "- <script>alert(1)</script>",
      "_<script>alert(1)</script>_",
    ]) {
      const html = renderJournalBody(text);
      expect(html).not.toMatch(/<script|<img/);
      expect(html).toContain("&lt;");
    }
    expect(renderJournalBody("Faith & hope")).toBe("<p>Faith &amp; hope</p>");
  });

  it("answers an empty entry with nothing", () => {
    expect(renderJournalBody("")).toBe("");
    expect(renderJournalBody("\r\n\r\n")).toBe("");
  });
});
