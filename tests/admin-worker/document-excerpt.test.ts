/**
 * Verbatim document-excerpt extraction (CHURCH_DOCUMENT bodyExcerpt). These
 * tests pin the pure extractor: it takes only long prose paragraphs in document
 * order, filters navigation/copyright chrome, truncates at a sentence boundary,
 * and returns null rather than guessing when no confident prose exists; and the
 * fetch wrapper is a no-op offline.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  extractExcerptFromHtml,
  fetchDocumentExcerpt,
} from "@/lib/admin-worker/structured/document-excerpt";

const SKIP = "ADMIN_WORKER_SKIP_NETWORK";
let savedSkip: string | undefined;

beforeEach(() => {
  savedSkip = process.env[SKIP];
});
afterEach(() => {
  if (savedSkip === undefined) delete process.env[SKIP];
  else process.env[SKIP] = savedSkip;
});

const P1 =
  "That the spirit of revolutionary change, which has long been disturbing the nations of the world, should have passed beyond the sphere of politics and made its influence felt in the cognate sphere of practical economics is not surprising.";
const P2 =
  "The elements of the conflict now raging are unmistakable, in the vast expansion of industrial pursuits and the marvellous discoveries of science; in the changed relations between masters and workmen.";

const HTML = `<html><head><style>p{margin:0}</style></head><body>
<p>Menu</p>
<p>Search the archive of documents — Index</p>
<p>${P1}</p>
<p>${P2}</p>
<p>Copyright © Libreria Editrice Vaticana. All rights reserved.</p>
</body></html>`;

describe("extractExcerptFromHtml", () => {
  it("takes the long prose paragraphs and skips chrome", () => {
    const excerpt = extractExcerptFromHtml(HTML);
    expect(excerpt).not.toBeNull();
    expect(excerpt).toContain("spirit of revolutionary change");
    expect(excerpt).toContain("elements of the conflict");
    expect(excerpt).not.toContain("Copyright");
    expect(excerpt).not.toContain("Menu");
  });

  it("returns null when there is no confident prose", () => {
    expect(extractExcerptFromHtml("<p>Short.</p><p>Menu</p>")).toBeNull();
    expect(extractExcerptFromHtml("")).toBeNull();
  });

  it("truncates an over-long body at a sentence boundary within the cap", () => {
    const long = `<p>${`${P1} `.repeat(12)}</p>`;
    const excerpt = extractExcerptFromHtml(long);
    expect(excerpt).not.toBeNull();
    expect(excerpt!.length).toBeLessThanOrEqual(1200);
    expect(excerpt!.endsWith(".")).toBe(true);
  });
});

describe("fetchDocumentExcerpt", () => {
  it("is a no-op offline (skip-network)", async () => {
    process.env[SKIP] = "1";
    expect(await fetchDocumentExcerpt("https://www.vatican.va/doc.html")).toBeNull();
  });
});
