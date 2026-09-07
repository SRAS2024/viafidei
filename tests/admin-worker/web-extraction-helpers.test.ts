/**
 * Pure helpers behind the web-extraction pipeline fixes (audit WX-03 / WX-06 /
 * WX-09 / WX-14 / PR-04 / PR-15). Each test pins the RULE, not the wiring —
 * the dispatcher-level behaviour is covered in dispatcher-web-extraction.test.ts.
 */

import { describe, expect, it } from "vitest";

import {
  MAX_TRANSIENT_FETCH_ATTEMPTS,
  buildPrayerPublishPayload,
  candidateFetchEligibility,
  classifyFetchFailure,
  cleanSourceTitle,
  deriveDocumentTitle,
  derivedParentField,
  detectReadLanguage,
  entityHintFor,
  expectedValueVariants,
  extractionCursorWhere,
  extractorFieldTitle,
  fetchRetryBackoffMs,
  formattingQualityScore,
  stripHonorific,
  titleFromUrlPath,
} from "@/lib/admin-worker/web-extraction-helpers";

describe("cleanSourceTitle (WX-09)", () => {
  it("drops trailing site + section segments", () => {
    expect(
      cleanSourceTitle("St. Francis of Assisi - Saints & Angels - Catholic Online", "catholic.org"),
    ).toBe("St. Francis of Assisi");
    expect(
      cleanSourceTitle("Liturgical Year: Advent | Catholic Culture", "catholicculture.org"),
    ).toBe("Liturgical Year: Advent");
  });

  it("drops a leading site/breadcrumb segment", () => {
    expect(cleanSourceTitle("Catholic Online » Prayers » Act of Contrition", "catholic.org")).toBe(
      "Act of Contrition",
    );
  });

  it("never empties a title that is nothing but the site name", () => {
    expect(cleanSourceTitle("Catholic Online", "catholic.org")).toBe("Catholic Online");
  });

  it("decodes entities and strips stray markup", () => {
    expect(cleanSourceTitle("Sts.&nbsp;Peter &amp; Paul", "example.org")).toBe("Sts. Peter & Paul");
  });

  it("returns null for an empty title", () => {
    expect(cleanSourceTitle(null)).toBeNull();
    expect(cleanSourceTitle("   ")).toBeNull();
  });
});

describe("deriveDocumentTitle / titleFromUrlPath (WX-14)", () => {
  it("uses the first heading line of a PDF body when there is no <title>", () => {
    const title = deriveDocumentTitle({
      title: null,
      url: "https://www.vatican.va/content/leo-xiii/en/encyclicals/documents/hf_l-xiii_enc_15051891.pdf",
      bodyText: "RERUM NOVARUM\n\nEncyclical of Pope Leo XIII on capital and labor.\n",
    });
    expect(title).toBe("RERUM NOVARUM");
  });

  it("falls back to the URL path when the body has no heading", () => {
    expect(
      deriveDocumentTitle({
        title: null,
        url: "https://www.vatican.va/documents/rerum-novarum.pdf",
        bodyText: "1. It is a difficult matter, and one that admits of no easy solution.",
      }),
    ).toBe("Rerum Novarum");
  });

  it("skips index-style path segments", () => {
    expect(titleFromUrlPath("https://x.org/encyclicals/laudato-si/index.html")).toBe("Laudato Si");
  });

  it("is null when nothing names the document", () => {
    expect(deriveDocumentTitle({ title: "", url: "https://x.org/", bodyText: "" })).toBeNull();
  });
});

describe("detectReadLanguage (PR-15)", () => {
  it("reads a language prefix out of the URL path", () => {
    expect(detectReadLanguage("https://www.usccb.org/es/prayers/oracion", "")).toBe("es");
  });

  it("votes on stop-words when the URL says nothing", () => {
    expect(
      detectReadLanguage(
        "https://example.org/oracion",
        "Señor, por tu bondad, escucha nuestra oración; que con el pan de cada día nuestro pueblo camine para siempre con una fe firme.",
      ),
    ).toBe("es");
  });

  it("defaults to English, including for an English page quoting Latin", () => {
    expect(
      detectReadLanguage(
        "https://example.org/prayer",
        "The Salve Regina (Latin: Salve Regina) is the prayer we sing to our Lady, and it is one of the four Marian antiphons of the Church.",
      ),
    ).toBe("en");
  });
});

describe("classifyFetchFailure + backoff (WX-06)", () => {
  it("treats timeouts, network drops, 429 and 5xx as transient", () => {
    expect(classifyFetchFailure({ errorClass: "AbortError" })).toBe("transient");
    expect(
      classifyFetchFailure({ errorClass: "FETCH_FAILED", rejectionReason: "fetch failed" }),
    ).toBe("transient");
    expect(classifyFetchFailure({ rejectionReason: "HTTP 429" })).toBe("transient");
    expect(classifyFetchFailure({ rejectionReason: "HTTP 503" })).toBe("transient");
    expect(classifyFetchFailure({ httpStatus: 500 })).toBe("transient");
  });

  it("treats a verdict about the page as permanent", () => {
    expect(classifyFetchFailure({ errorClass: "UNAPPROVED_HOST" })).toBe("permanent");
    expect(classifyFetchFailure({ errorClass: "LOGIN_PAGE" })).toBe("permanent");
    expect(classifyFetchFailure({ rejectionReason: "HTTP 404" })).toBe("permanent");
    expect(classifyFetchFailure({ rejectionReason: "HTTP 410" })).toBe("permanent");
  });

  it("backs off further with each attempt and bounds the retries", () => {
    expect(fetchRetryBackoffMs(0)).toBe(0);
    expect(fetchRetryBackoffMs(1)).toBeLessThan(fetchRetryBackoffMs(2));
    expect(fetchRetryBackoffMs(2)).toBeLessThan(fetchRetryBackoffMs(3));
    expect(MAX_TRANSIENT_FETCH_ATTEMPTS).toBeGreaterThan(1);
  });

  it("only lets a candidate be re-selected once its backoff has elapsed (WX-05)", () => {
    const now = new Date("2026-09-07T12:00:00Z");
    const where = candidateFetchEligibility(now) as {
      OR: Array<Record<string, unknown>>;
    };
    // A never-fetched candidate is always eligible.
    expect(where.OR.some((c) => "lastFetchedAt" in c && c.lastFetchedAt === null)).toBe(true);
    // The one-attempt clause requires a lastFetchedAt older than the backoff.
    const oneAttempt = where.OR.find((c) => c.fetchAttempts === 1) as {
      lastFetchedAt: { lt: Date };
    };
    expect(now.getTime() - oneAttempt.lastFetchedAt.lt.getTime()).toBe(fetchRetryBackoffMs(1));
  });
});

describe("expectedValueVariants + entityHintFor (WX-03)", () => {
  it("turns a schema feast day into the form a real page prints", () => {
    const v = expectedValueVariants("SAINT", "feastDay", "10-04");
    expect(v.primary).toBe("October 4");
    expect(v.all).toContain("4 October");
    expect(v.all).toContain("Oct 4");
  });

  it("expands an ISO date into a printable date", () => {
    const v = expectedValueVariants("APPARITION", "apparitionDate", "1917-05-13");
    expect(v.primary).toBe("May 13, 1917");
  });

  it("has no primary form for a bare small number (unverifiable by substring)", () => {
    expect(expectedValueVariants("SAINT", "feastMonth", "10").primary).toBeNull();
  });

  it("compares names by the cleaned, honorific-free name", () => {
    const v = expectedValueVariants(
      "SAINT",
      "saintName",
      "Saint Francis of Assisi - Catholic Online",
    );
    expect(v.primary).toBe("Francis of Assisi");
    expect(stripHonorific("St. Thérèse of Lisieux")).toBe("Thérèse of Lisieux");
  });

  it("marks derived feast fields as verified with their parent", () => {
    expect(derivedParentField("SAINT", "feastMonth")).toBe("feastDay");
    expect(derivedParentField("SAINT", "saintName")).toBeNull();
    expect(derivedParentField("PRAYER", "prayerTitle")).toBeNull();
  });

  it("names the entity a corroborating page must be about", () => {
    expect(
      entityHintFor(
        "SAINT",
        { saintName: "St. Francis of Assisi" },
        "St. Francis of Assisi - Saints & Angels - Catholic Online",
      ),
    ).toBe("Francis of Assisi");
  });
});

describe("extractorFieldTitle / formattingQualityScore", () => {
  it("names a package from the extractor's own field when the page has no title", () => {
    expect(extractorFieldTitle({ prayerTitle: "Act of Contrition" })).toBe("Act of Contrition");
    expect(extractorFieldTitle({})).toBeNull();
  });

  it("scores clean text 1.0 and deducts for markup / boilerplate leaks (WX-02)", () => {
    expect(
      formattingQualityScore({ body: "Our Father, who art in heaven, hallowed be thy name." }, {}),
    ).toBe(1);
    expect(
      formattingQualityScore({ body: "Our Father <div class='x'>who art in heaven</div>" }, {}),
    ).toBeLessThan(1);
    // Never zero: a zero dimension is a hard strict-QA FAIL.
    expect(
      formattingQualityScore({ body: "<p>&nbsp;</p> Advertisement — Read more" }, {}),
    ).toBeGreaterThan(0);
  });

  it("honours an explicit extractor formatting score", () => {
    expect(formattingQualityScore({}, { score: 0.5 })).toBe(0.5);
  });
});

describe("extractionCursorWhere (WX-01)", () => {
  it("is empty for a fresh scan and strictly-after for a resumed one", () => {
    expect(extractionCursorWhere(null)).toEqual({});
    const at = new Date("2026-09-01T00:00:00Z");
    const where = extractionCursorWhere({ at, id: "r5" }) as { OR: unknown[] };
    expect(where.OR).toHaveLength(2);
    expect(where.OR[0]).toEqual({ createdAt: { gt: at } });
  });
});

describe("buildPrayerPublishPayload (PR-04)", () => {
  const body =
    "Our Father, who art in heaven, hallowed be thy name; thy kingdom come, thy will be done. Amen.";

  it("builds a complete schema payload from raw extractor fields", () => {
    const out = buildPrayerPublishPayload({
      fields: {
        prayerTitle: "Our Father | Catholic Online",
        prayerText: body,
        prayerType: "morning",
        // The extractor stamps the literal content type as the category.
        category: "PRAYER",
        language: "en",
      },
      title: "Our Father",
      slug: "our-father",
      host: "catholic.org",
      sourceUrl: "https://www.catholic.org/prayers/our-father",
    });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.payload.slug).toBe("our-father");
    expect(out.payload.title).toBe("Our Father");
    expect(out.payload.body).toBe(body);
    expect(out.payload.prayerType).toBe("morning");
    // The literal "PRAYER" never survives as a category label.
    expect(out.payload.category).not.toBe("PRAYER");
    expect(out.payload.citations).toEqual(["https://www.catholic.org/prayers/our-father"]);
    // Backwards compatibility: pages that still read prayerText keep working.
    expect(out.payload.prayerText).toBe(body);
  });

  it("carries the detected page language through", () => {
    const out = buildPrayerPublishPayload({
      fields: { prayerTitle: "Oración por la vida", prayerText: body, language: "es" },
      title: "Oración por la vida",
      slug: "oracion-por-la-vida",
      sourceUrl: "https://www.usccb.org/es/prayers/oracion-por-la-vida",
    });
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.payload.language).toBe("es");
  });

  it("refuses a prayer with no body or no citation", () => {
    const noBody = buildPrayerPublishPayload({
      fields: { prayerTitle: "Our Father" },
      title: "Our Father",
      slug: "our-father",
      sourceUrl: "https://www.catholic.org/prayers/our-father",
    });
    expect(noBody.ok).toBe(false);
    const noCitation = buildPrayerPublishPayload({
      fields: { prayerTitle: "Our Father", prayerText: body },
      title: "Our Father",
      slug: "our-father",
    });
    expect(noCitation.ok).toBe(false);
  });
});
