/**
 * The curated ecumenical-council dataset that fills the Church-history timeline
 * (`/history`). It must cover all 21 councils, span from Nicaea (325) to
 * Vatican II (1962), and map cleanly onto dated timeline events so the worker
 * publishes the backbone of Church history, not just the modern encyclicals.
 */
import { describe, expect, it } from "vitest";

import { churchHistoryKnowledge } from "@/lib/checklist/knowledge/church-history";
import type { PublishedItem } from "@/lib/data/published";
import { toHistoryEvents } from "@/app/history/historyEvents";

describe("curated ecumenical councils", () => {
  it("covers all 21 ecumenical councils as CHURCH_DOCUMENT council_documents", () => {
    expect(churchHistoryKnowledge).toHaveLength(21);
    for (const e of churchHistoryKnowledge) {
      expect(e.contentType).toBe("CHURCH_DOCUMENT");
      expect(e.payload.documentType).toBe("council_document");
      expect(e.payload.issuedDate as string).toMatch(/^\d{4}-01-01$/);
    }
  });

  it("has unique slugs and anchors the great councils to their years", () => {
    const slugs = churchHistoryKnowledge.map((e) => e.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    const year = (slug: string) =>
      Number(
        (churchHistoryKnowledge.find((e) => e.slug === slug)!.payload.issuedDate as string).slice(
          0,
          4,
        ),
      );
    expect(year("first-council-of-nicaea")).toBe(325);
    expect(year("council-of-trent")).toBe(1545);
    expect(year("first-vatican-council")).toBe(1869);
    expect(year("second-vatican-council")).toBe(1962);
  });

  it("maps onto the history timeline spanning antiquity to the modern era, newest-first", () => {
    const items = churchHistoryKnowledge.map(
      (e) =>
        ({
          slug: e.slug,
          title: e.payload.title as string,
          payload: e.payload,
        }) as unknown as PublishedItem,
    );
    const events = toHistoryEvents(items);
    expect(events).toHaveLength(21);
    // Sorted newest-first.
    for (let i = 1; i < events.length; i++) {
      expect(events[i - 1].sortYear).toBeGreaterThanOrEqual(events[i].sortYear);
    }
    const years = events.map((e) => e.sortYear);
    expect(Math.min(...years)).toBe(325);
    expect(Math.max(...years)).toBe(1962);
  });
});
