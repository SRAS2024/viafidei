import { describe, expect, it } from "vitest";

import { historyYearBounds, toHistoryEvents } from "@/app/history/historyEvents";
import type { PublishedItem } from "@/lib/data/published";

function doc(slug: string, title: string, payload: Record<string, unknown>): PublishedItem {
  return {
    id: slug,
    checklistItemId: slug,
    contentType: "CHURCH_DOCUMENT",
    slug,
    title,
    payload: { slug, title, ...payload },
    authorityLevel: "VATICAN",
    version: 1,
    publishedAt: new Date(),
  };
}

describe("toHistoryEvents", () => {
  it("maps a Church document onto a dated timeline event", () => {
    const [event] = toHistoryEvents([
      doc("lumen-gentium", "Lumen Gentium", {
        documentType: "council_document",
        issuedDate: "1964-11-21",
        issuingAuthority: "Second Vatican Council",
        keyThemes: ["The Church", "The People of God"],
        bodyExcerpt: "Christ is the light of nations.",
      }),
    ]);
    expect(event).toMatchObject({
      slug: "lumen-gentium",
      title: "Lumen Gentium",
      sortYear: 1964,
      period: "council_document",
      periodLabel: "Council Document",
      documentType: "council_document",
      context: "Second Vatican Council",
      significance: "The Church, The People of God",
      body: "Christ is the light of nations.",
    });
  });

  it("falls back to the summary for the body and skips undatable documents", () => {
    const events = toHistoryEvents([
      doc("a", "A", {
        documentType: "encyclical",
        issuedDate: "1891-05-15",
        summary: "On capital and labor.",
      }),
      doc("b", "B", { documentType: "encyclical", issuedDate: "not-a-date", summary: "x" }),
    ]);
    expect(events).toHaveLength(1);
    expect(events[0]?.slug).toBe("a");
    expect(events[0]?.body).toBe("On capital and labor.");
  });

  it("sorts events newest-first", () => {
    const events = toHistoryEvents([
      doc("old", "Old", { issuedDate: "0325-06-19" }),
      doc("new", "New", { issuedDate: "2013-11-24" }),
      doc("mid", "Mid", { issuedDate: "1965-12-07" }),
    ]);
    expect(events.map((e) => e.slug)).toEqual(["new", "mid", "old"]);
  });
});

describe("historyYearBounds", () => {
  it("spans from Christ's ministry to the current year", () => {
    const current = new Date().getUTCFullYear();
    expect(historyYearBounds([])).toEqual({ minYear: 30, maxYear: current });
  });

  it("widens for events outside the default range", () => {
    const events = toHistoryEvents([doc("nicaea", "Nicaea", { issuedDate: "0325-06-19" })]);
    const bounds = historyYearBounds(events);
    expect(bounds.minYear).toBe(30); // floor stays at Christ's ministry
    expect(bounds.maxYear).toBe(new Date().getUTCFullYear());
  });
});
