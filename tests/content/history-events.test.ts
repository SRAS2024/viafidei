/**
 * The /history merge (audit HIST-01/02/03/08/09/10): the static dataset is
 * the spine; published CHURCH_DOCUMENT rows enrich a matching static event
 * or become their own dated "document" event, with precision derived from
 * the payload, chronological order, related links filtered to published
 * pages, and no bodies in the output.
 */
import { describe, expect, it } from "vitest";

import fs from "node:fs";
import path from "node:path";

import {
  buildTimeline,
  documentDatePrecision,
  historyYearBounds,
  timelineDocumentFromPublished,
  toHistoryTimeline,
} from "@/app/history/historyEvents";
import { CHURCH_HISTORY_EVENTS } from "@/lib/content-shared/church-history-events";
import {
  DOCUMENT_ROUTE_BASE,
  RELATED_ROUTE_BASE,
  relatedLinkLabel,
} from "@/lib/content-shared/church-history/timeline";
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

  it("enriches a static encyclical event with its published document by slug", () => {
    // Rerum Novarum is a static event under its published slug, so the
    // published row adds the document link instead of a second entry.
    const timeline = toHistoryTimeline([
      doc("rerum-novarum", "Rerum Novarum", {
        documentType: "encyclical",
        issuedDate: "1891-05-15",
        canonicalUrl: "https://www.vatican.va/rerum-novarum",
      }),
    ]);
    const matches = timeline.events.filter((e) => e.slug === "rerum-novarum");
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({
      dateLabel: "15 May 1891",
      kindLabel: "Encyclical",
      href: "/liturgy-history/rerum-novarum",
      canonicalUrl: "https://www.vatican.va/rerum-novarum",
      fromDataset: true,
    });
    expect(timeline.documentCount).toBe(0);
    expect(timeline.events).toHaveLength(STATIC_COUNT);
  });

  it("turns an unmatched document into a dated document event with a capped excerpt", () => {
    // A slug no static event claims, so nothing in the curated spine absorbs it.
    const slug = "an-unlisted-labour-encyclical";
    expect(
      CHURCH_HISTORY_EVENTS.some((e) => e.slug === slug || e.links?.documentSlug === slug),
    ).toBe(false);
    const timeline = toHistoryTimeline([
      doc(slug, "An Unlisted Labour Encyclical", {
        documentType: "encyclical",
        issuedDate: "1891-05-15",
        issuingAuthority: "Pope Leo XIII",
        keyThemes: ["Capital and labor", "Just wage"],
        summary: "x".repeat(600),
        bodyExcerpt: "BODY",
        canonicalUrl: "https://www.vatican.va/an-unlisted-labour-encyclical",
      }),
    ]);
    const rn = timeline.events.find((e) => e.slug === slug);
    expect(rn).toMatchObject({
      year: 1891,
      dateLabel: "15 May 1891",
      precision: "day",
      era: "revolution-19c",
      kind: "document",
      kindLabel: "Encyclical",
      context: "Pope Leo XIII",
      significance: "Capital and labor, Just wage",
      href: `/liturgy-history/${slug}`,
      fromDataset: false,
    });
    expect(rn?.excerpt?.length).toBeLessThanOrEqual(400);
    expect(rn?.excerpt?.endsWith("…")).toBe(true);
    expect(JSON.stringify(timeline)).not.toContain("BODY");
    expect(timeline.documentCount).toBe(1);
  });

  it("cuts a long excerpt between words, never in the middle of one", () => {
    const words = "the nature and divisions of philosophy and its harmony with faith; ".repeat(12);
    const timeline = toHistoryTimeline([
      doc("an-unlisted-letter", "An Unlisted Letter", {
        documentType: "encyclical",
        issuedDate: "1923-06-29",
        summary: words,
      }),
    ]);
    const excerpt = timeline.events.find((e) => e.slug === "an-unlisted-letter")?.excerpt ?? "";
    expect(excerpt.endsWith("…")).toBe(true);
    const lastWord = excerpt.slice(0, -1).split(" ").at(-1)!;
    // The excerpt ends on a whole word of the text, with no comma or stop before the "…".
    expect(words.split(/[\s;]+/)).toContain(lastWord);
    expect(excerpt).not.toMatch(/[\s,;:.]…$/);
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

  it("labels a related link with its page's own title", () => {
    const timeline = buildTimeline([], {
      publishedSlugs: {
        saints: new Set(["saint-mark-the-evangelist"]),
        apparitions: new Set(["apparition-our-lady-of-the-pillar-zaragoza"]),
      },
      relatedTitles: {
        saints: new Map([["saint-mark-the-evangelist", "Saint Mark the Evangelist"]]),
        apparitions: new Map([
          [
            "apparition-our-lady-of-the-pillar-zaragoza",
            "Our Lady of the Pillar Appearing to Saint James at Zaragoza",
          ],
        ]),
      },
    });
    const labels = timeline.events.flatMap((e) => e.links.map((l) => l.label));
    expect(labels).toContain("Saint Mark the Evangelist");
    expect(labels).toContain("Our Lady of the Pillar Appearing to Saint James at Zaragoza");
    expect(labels).not.toContain("Saint Mark The Evangelist");
  });

  it("tells a Doctor's page from the same person's page among the saints", () => {
    const timeline = buildTimeline([], {
      publishedSlugs: {
        saints: new Set(["saint-jerome"]),
        doctors: new Set(["doctor-jerome"]),
      },
      relatedTitles: {
        saints: new Map([["saint-jerome", "Saint Jerome"]]),
        doctors: new Map([["doctor-jerome", "Saint Jerome"]]),
      },
    });
    const row = timeline.events.find((e) => e.slug === "jerome-begins-the-vulgate");
    expect(row?.links.filter((l) => l.href.includes("jerome"))).toEqual([
      { href: "/saints/saint-jerome", label: "Saint Jerome" },
      { href: "/doctors/doctor-jerome", label: "Saint Jerome", asDoctor: true },
    ]);
  });

  it("makes words of a slug only for a page whose title is not known", () => {
    expect(relatedLinkLabel("pope-saint-paul-vi")).toBe("Pope Saint Paul VI");
    expect(relatedLinkLabel("pope-saint-john-xxiii")).toBe("Pope Saint John XXIII");
    expect(relatedLinkLabel("our-lady-of-fatima")).toBe("Our Lady of Fatima");
    expect(relatedLinkLabel("saints-philip-and-james")).toBe("Saints Philip and James");
    expect(relatedLinkLabel("doctor-augustine-of-hippo")).toBe("Augustine of Hippo");
    expect(relatedLinkLabel("apparition-our-lady-of-the-pillar-zaragoza")).toBe(
      "Our Lady of the Pillar Zaragoza",
    );
  });

  it("only ever links to routes that exist under src/app", () => {
    // A "Related" chip is a real navigation, so every base the merge can emit
    // must have a [slug] route on disk — otherwise the reader gets a 404.
    const bases = [DOCUMENT_ROUTE_BASE, ...Object.values(RELATED_ROUTE_BASE)];
    for (const base of bases) {
      const route = path.join(process.cwd(), "src/app", base.replace(/^\//, ""), "[slug]/page.tsx");
      expect(fs.existsSync(route), route).toBe(true);
    }
    // And no event emits a link outside those bases (external "Official text"
    // links excepted, which are absolute URLs on the document's own host).
    const timeline = buildTimeline([]);
    for (const event of timeline.events) {
      for (const link of event.links) {
        if (link.external) {
          expect(link.href, `${event.slug}`).toMatch(/^https:\/\//);
          continue;
        }
        expect(
          bases.some((b) => link.href.startsWith(`${b}/`)),
          `${event.slug} → ${link.href}`,
        ).toBe(true);
      }
    }
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
