/**
 * The cached /history loader (src/lib/data/history-timeline.ts): reads a
 * body-free projection of published documents plus the related-page slug
 * sets, caches under the content-type tags the worker revalidates on
 * publish, and hands the page a merged timeline with no bodies in it.
 */
import fs from "node:fs";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

// vi.mock is hoisted above the imports, so the spy has to be hoisted with it.
const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock("@/lib/db/client", () => ({ prisma: { publishedContent: { findMany } } }));

import {
  HISTORY_TIMELINE_CACHE_TAGS,
  HISTORY_TIMELINE_REVALIDATE_SECONDS,
  loadHistoryTimeline,
  readHistoryTimelineInputs,
} from "@/lib/data/history-timeline";
import { CHURCH_HISTORY_EVENTS } from "@/lib/content-shared/church-history-events";

type Where = { contentType: string };

function seed() {
  findMany.mockReset();
  findMany.mockImplementation(async ({ where }: { where: Where }) => {
    switch (where.contentType) {
      case "CHURCH_DOCUMENT":
        return [
          {
            slug: "first-council-of-nicaea",
            title: "First Council of Nicaea",
            payload: {
              documentType: "council_document",
              issuedDate: "0325-01-01",
              canonicalUrl: "https://en.wikipedia.org/wiki/First_Council_of_Nicaea",
              bodyExcerpt: "NEVER SHIPPED",
            },
          },
          {
            slug: "rerum-novarum",
            title: "Rerum Novarum",
            payload: {
              documentType: "encyclical",
              issuedDate: "1891-05-15",
              summary: "On capital and labor.",
              bodyExcerpt: "NEVER SHIPPED",
            },
          },
        ];
      case "SAINT":
        return [{ slug: "saint-peter" }];
      case "POPE":
      case "DOCTOR":
      case "APPARITION":
        return [];
      default:
        throw new Error(`unexpected contentType ${where.contentType}`);
    }
  });
}

describe("history timeline loader", () => {
  it("reads a body-free projection and the published slug sets", async () => {
    seed();
    const inputs = await readHistoryTimelineInputs();
    expect(inputs.documents).toHaveLength(2);
    expect(JSON.stringify(inputs)).not.toContain("NEVER SHIPPED");
    expect(inputs.publishedSlugs).toEqual({
      popes: [],
      saints: ["saint-peter"],
      doctors: [],
      apparitions: [],
    });
    // One documents read + one slug read per related type, selecting slugs only.
    expect(findMany).toHaveBeenCalledTimes(5);
    expect(findMany.mock.calls[0]?.[0]).toMatchObject({
      where: { contentType: "CHURCH_DOCUMENT", isPublished: true },
      select: { slug: true, title: true, payload: true },
    });
  });

  it("merges into the static spine with links filtered to published pages", async () => {
    seed();
    const timeline = await loadHistoryTimeline();
    expect(timeline.events).toHaveLength(CHURCH_HISTORY_EVENTS.length + 1);
    expect(timeline.documentCount).toBe(1);
    const nicaea = timeline.events.find((e) => e.slug === "first-council-of-nicaea");
    expect(nicaea?.href).toBe("/liturgy-history/first-council-of-nicaea");
    expect(nicaea?.dateLabel).toBe("20 May 325");
    const pentecost = timeline.events.find((e) => e.slug === "pentecost");
    expect(pentecost?.links).toEqual([{ href: "/saints/saint-peter", label: "Saint Peter" }]);
    const peter = timeline.events.find((e) => e.slug === "martyrdom-of-saint-peter");
    expect(peter?.links.map((l) => l.href)).toEqual(["/saints/saint-peter"]);
    expect(JSON.stringify(timeline)).not.toContain("NEVER SHIPPED");
  });

  it("caches for an hour under the tags the worker revalidates on publish", () => {
    expect(HISTORY_TIMELINE_REVALIDATE_SECONDS).toBe(3600);
    expect(HISTORY_TIMELINE_CACHE_TAGS).toContain("content-type:CHURCH_DOCUMENT");
    expect(HISTORY_TIMELINE_CACHE_TAGS).toContain("content-type:SAINT");
    expect(HISTORY_TIMELINE_CACHE_TAGS).toContain("tab:history");
  });

  it("has the page read the cached timeline, not the full published rows", () => {
    // /history used to call listPublished("CHURCH_DOCUMENT"), which loads every
    // payload (bodyExcerpt included) on every request and hands it to a client
    // component. Guard the source so that regression is caught here.
    const page = fs.readFileSync(path.join(process.cwd(), "src/app/history/page.tsx"), "utf8");
    expect(page).toContain("loadHistoryTimeline");
    expect(page).not.toContain("listPublished");
    // Count and opening label are derived from the merged list, server-side.
    expect(page).toContain("events.length");
    expect(page).toContain("dateLabel");
  });
});
