/**
 * The /history merge (audit HIST-01/02/03/08/09/10): the static dataset is
 * the spine; published CHURCH_DOCUMENT rows enrich a matching static event
 * or become their own dated "document" event, with precision derived from
 * the payload, chronological order, related links filtered to published
 * pages, and no bodies in the output.
 */
import { describe, expect, it } from "vitest";

import {
  buildTimeline,
  documentDatePrecision,
  historyYearBounds,
  timelineDocumentFromPublished,
  toHistoryTimeline,
} from "@/app/history/historyEvents";
import { CHURCH_HISTORY_EVENTS } from "@/lib/content-shared/church-history-events";
import { relatedLinkLabel } from "@/lib/content-shared/church-history/timeline";
import type { PublishedItem } from "@/lib/data/published";

function doc(slug: string, title: string, payload: Record<string, unknown>): PublishedItem {
  return {
    id: slug,
    checklistItemId: slug,
    contentType: "CHURCH_DOCUMENT",
    slug,
    title,
    subtitle: "",
    payload: { slug, title, ...payload },
    authorityLevel: "VATICAN",
    version: 1,
    publishedAt: new Date(),
  };
}

const STATIC_COUNT = CHURCH_HISTORY_EVENTS.length;

describe("buildTimeline", () => {
  it("renders the static dataset even with no published documents", () => {
    const timeline = buildTimeline([], { currentYear: 2026 });
    expect(timeline.events).toHaveLength(STATIC_COUNT);
    expect(timeline.documentCount).toBe(0);
    expect(timeline.events[0]).toMatchObject({
      slug: "pentecost",
      dateLabel: "c. 33",
      era: "apostolic",
      fromDataset: true,
    });
    expect(timeline.minYear).toBe(30);
    expect(timeline.maxYear).toBe(2026);
    expect(timeline.eras.map((e) => e.key)).toContain("apostolic");
    expect(timeline.eras.reduce((n, e) => n + e.count, 0)).toBe(STATIC_COUNT);
  });

  it("enriches a static council with its published document instead of duplicating it", () => {
    const timeline = toHistoryTimeline([
      doc("first-council-of-nicaea", "First Council of Nicaea", {
        documentType: "council_document",
        issuedDate: "0325-01-01",
        canonicalUrl: "https://en.wikipedia.org/wiki/First_Council_of_Nicaea",
        bodyExcerpt: "SHOULD NOT SHIP",
      }),
    ]);
    const matches = timeline.events.filter((e) => e.slug === "first-council-of-nicaea");
    expect(matches).toHaveLength(1);
    const [nicaea] = matches;
    // Static facts win: the real opening day, not the -01-01 placeholder.
    expect(nicaea).toMatchObject({
      dateLabel: "20 May 325",
      kind: "council",
      href: "/liturgy-history/first-council-of-nicaea",
      canonicalUrl: "https://en.wikipedia.org/wiki/First_Council_of_Nicaea",
      documentType: "council_document",
      fromDataset: true,
    });
    expect(nicaea?.links).toEqual(
      expect.arrayContaining([
        { href: "/liturgy-history/first-council-of-nicaea", label: "Read the document" },
        {
          href: "https://en.wikipedia.org/wiki/First_Council_of_Nicaea",
          label: "Official text",
          external: true,
        },
      ]),
    );
    expect(JSON.stringify(timeline)).not.toContain("SHOULD NOT SHIP");
    expect(timeline.documentCount).toBe(0);
    expect(timeline.events).toHaveLength(STATIC_COUNT);
  });

  it("matches a document to an event by the event's own slug when no documentSlug is curated", () => {
    const timeline = toHistoryTimeline([
      doc("munificentissimus-deus", "Munificentissimus Deus", {
        documentType: "apostolic_constitution",
        issuedDate: "1950-11-01",
        canonicalUrl: "https://www.vatican.va/x",
      }),
    ]);
    const matches = timeline.events.filter((e) => e.slug === "munificentissimus-deus");
    expect(matches).toHaveLength(1);
    expect(matches[0]?.href).toBe("/liturgy-history/munificentissimus-deus");
    expect(matches[0]?.kindLabel).toBe("Apostolic Constitution");
  });

  it("turns an unmatched document into a dated document event with a capped excerpt", () => {
    const timeline = toHistoryTimeline([
      doc("rerum-novarum", "Rerum Novarum", {
        documentType: "encyclical",
        issuedDate: "1891-05-15",
        issuingAuthority: "Pope Leo XIII",
        keyThemes: ["Capital and labor", "Just wage"],
        summary: "x".repeat(600),
        bodyExcerpt: "BODY",
        canonicalUrl: "https://www.vatican.va/rerum-novarum",
      }),
    ]);
    const rn = timeline.events.find((e) => e.slug === "rerum-novarum");
    expect(rn).toMatchObject({
      year: 1891,
      dateLabel: "15 May 1891",
      precision: "day",
      era: "revolution-19c",
      kind: "document",
      kindLabel: "Encyclical",
      context: "Pope Leo XIII",
      significance: "Capital and labor, Just wage",
      href: "/liturgy-history/rerum-novarum",
      fromDataset: false,
    });
    expect(rn?.excerpt?.length).toBeLessThanOrEqual(400);
    expect(rn?.excerpt?.endsWith("…")).toBe(true);
    expect(JSON.stringify(timeline)).not.toContain("BODY");
    expect(timeline.documentCount).toBe(1);
  });

  it("skips undatable documents and keeps the merged list chronological", () => {
    const timeline = toHistoryTimeline([
      doc("b", "B", { documentType: "encyclical", issuedDate: "not-a-date" }),
      doc("new", "New", { issuedDate: "2013-11-24" }),
      doc("old", "Old", { issuedDate: "0325-06-19" }),
    ]);
    expect(timeline.events.find((e) => e.slug === "b")).toBeUndefined();
    const keys = timeline.events.map((e) => e.sortKey);
    for (let i = 1; i < keys.length; i++) expect(keys[i - 1]! <= keys[i]!).toBe(true);
    const idx = (slug: string) => timeline.events.findIndex((e) => e.slug === slug);
    expect(idx("old")).toBeLessThan(idx("new"));
    // Same-year ordering is by date, not title: Nicaea opened 20 May, before 19 June.
    expect(idx("first-council-of-nicaea")).toBeLessThan(idx("old"));
  });

  it("keeps related links only for published pages when slug sets are supplied", () => {
    const withSets = buildTimeline([], {
      publishedSlugs: { saints: new Set(["saint-peter"]), popes: new Set() },
    });
    const pentecost = withSets.events.find((e) => e.slug === "pentecost");
    expect(pentecost?.links).toEqual([{ href: "/saints/saint-peter", label: "Saint Peter" }]);
    const peter = withSets.events.find((e) => e.slug === "martyrdom-of-saint-peter");
    // pope-saint-peter is not published → dropped; saint-peter kept.
    expect(peter?.links.map((l) => l.href)).toEqual(["/saints/saint-peter"]);

    // Without sets the curated links are trusted as-is.
    const trusted = buildTimeline([]);
    const peter2 = trusted.events.find((e) => e.slug === "martyrdom-of-saint-peter");
    expect(peter2?.links.map((l) => l.href)).toEqual([
      "/popes/pope-saint-peter",
      "/saints/saint-peter",
    ]);
  });

  it("labels related chips from their slugs", () => {
    expect(relatedLinkLabel("pope-saint-paul-vi")).toBe("Pope Saint Paul VI");
    expect(relatedLinkLabel("our-lady-of-fatima")).toBe("Our Lady Of Fatima");
  });
});

describe("documentDatePrecision", () => {
  it("treats a council's -01-01 placeholder as year precision", () => {
    expect(
      documentDatePrecision({ documentType: "council_document", issuedDate: "0325-01-01" }),
    ).toEqual({ year: 325, precision: "year" });
  });

  it("trusts a full ISO day on any other document", () => {
    expect(documentDatePrecision({ documentType: "encyclical", issuedDate: "1891-05-15" })).toEqual(
      { year: 1891, date: "1891-05-15", precision: "day" },
    );
    // An encyclical genuinely issued on 1 January keeps its day.
    expect(documentDatePrecision({ documentType: "encyclical", issuedDate: "1967-01-01" })).toEqual(
      { year: 1967, date: "1967-01-01", precision: "day" },
    );
  });

  it("falls back to year precision for loose dates and null for none", () => {
    expect(documentDatePrecision({ issuedDate: "1215" })).toEqual({
      year: 1215,
      precision: "year",
    });
    expect(documentDatePrecision({ issuedDate: "not-a-date" })).toBeNull();
    expect(documentDatePrecision({})).toBeNull();
  });
});

describe("timelineDocumentFromPublished", () => {
  it("projects only the fields the timeline needs", () => {
    const projected = timelineDocumentFromPublished(
      doc("x", "X", {
        documentType: "encyclical",
        issuedDate: "1891-05-15",
        bodyExcerpt: "BODY",
        keyThemes: ["a", 3],
      }),
    );
    expect(projected).toEqual({
      slug: "x",
      title: "X",
      documentType: "encyclical",
      issuedDate: "1891-05-15",
      issuingAuthority: undefined,
      keyThemes: ["a"],
      summary: undefined,
      canonicalUrl: undefined,
    });
    expect(Object.keys(projected)).not.toContain("bodyExcerpt");
  });
});

describe("historyYearBounds", () => {
  it("spans from Christ's ministry to the current year", () => {
    expect(historyYearBounds([], 2026)).toEqual({ minYear: 30, maxYear: 2026 });
    expect(historyYearBounds([325, 1962], 2026)).toEqual({ minYear: 30, maxYear: 2026 });
  });

  it("widens for events outside the default range", () => {
    expect(historyYearBounds([20, 2030], 2026)).toEqual({ minYear: 20, maxYear: 2030 });
  });
});
