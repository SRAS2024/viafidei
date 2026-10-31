/**
 * The static Church-history dataset (src/lib/content-shared/church-history/*)
 * is the timeline's spine, so the whole thing is validated here: unique
 * slugs, era consistent with the year, precision consistent with the date,
 * one https citation on an allowed host, every related slug resolvable to a
 * curated knowledge entry, and every era / filter populated.
 */
import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  CHURCH_HISTORY_EVENTS,
  HISTORY_CITATION_HOSTS,
  HISTORY_ERAS,
  compareHistoryEvents,
  eraForYear,
  formatHistoryDate,
  historySortKey,
  type ChurchHistoryEvent,
} from "@/lib/content-shared/church-history-events";
import { apparitionKnowledge } from "@/lib/checklist/knowledge/apparitions";
import { churchDocumentKnowledge } from "@/lib/checklist/knowledge/church-documents";
import { churchHistoryKnowledge } from "@/lib/checklist/knowledge/church-history";
import { doctorKnowledge } from "@/lib/checklist/knowledge/doctors";
import { popeKnowledge } from "@/lib/checklist/knowledge/popes";
import { saintKnowledge } from "@/lib/checklist/knowledge/saints";
import { matchesHistoryFilter, FILTER_LABELS } from "@/app/history/HistoryTimelineClient";
import { buildTimeline } from "@/lib/content-shared/church-history/timeline";

const CURRENT_YEAR = new Date().getUTCFullYear();
const slugsOf = (entries: Array<{ slug: string }>) => new Set(entries.map((e) => e.slug));

/** Every `events-N.ts` part on disk, each read through its one exported array. */
const PART_DIR = path.join(process.cwd(), "src/lib/content-shared/church-history");
async function loadParts(): Promise<Array<{ file: string; events: ChurchHistoryEvent[] }>> {
  const files = fs
    .readdirSync(PART_DIR)
    .filter((f) => /^events-\d+\.ts$/.test(f))
    .sort();
  return Promise.all(
    files.map(async (file) => {
      const mod = (await import(/* @vite-ignore */ path.join(PART_DIR, file))) as Record<
        string,
        unknown
      >;
      const arrays = Object.values(mod).filter(Array.isArray) as ChurchHistoryEvent[][];
      expect(arrays, file).toHaveLength(1);
      return { file, events: arrays[0]! };
    }),
  );
}

describe("CHURCH_HISTORY_EVENTS dataset", () => {
  it("aggregates every part, sorted chronologically", async () => {
    // A tripwire without a pinned count, so curators can add events and parts
    // freely: every events-N.ts part on disk must be non-empty and merged into
    // the aggregate whole, and the aggregate must hold nothing else. A part
    // that fails to load, is never registered, or loses events in a bad merge
    // fails here instead of silently shrinking the timeline. The original
    // reviewed spine had 232 events, so the timeline never drops below that.
    const parts = await loadParts();
    expect(parts.length).toBeGreaterThanOrEqual(5);
    const aggregated = new Set(CHURCH_HISTORY_EVENTS);
    let total = 0;
    for (const { file, events } of parts) {
      expect(events.length, file).toBeGreaterThan(0);
      for (const e of events) expect(aggregated.has(e), `${file}: ${e.slug}`).toBe(true);
      total += events.length;
    }
    expect(CHURCH_HISTORY_EVENTS).toHaveLength(total);
    expect(CHURCH_HISTORY_EVENTS.length).toBeGreaterThanOrEqual(232);
    for (let i = 1; i < CHURCH_HISTORY_EVENTS.length; i++) {
      expect(compareHistoryEvents(CHURCH_HISTORY_EVENTS[i - 1]!, CHURCH_HISTORY_EVENTS[i]!)).toBe(
        -1,
      );
    }
    expect(CHURCH_HISTORY_EVENTS[0]?.slug).toBe("pentecost");
  });

  it("has unique slugs", () => {
    const slugs = CHURCH_HISTORY_EVENTS.map((e) => e.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  });

  it("keeps year, era, precision and date consistent", () => {
    for (const e of CHURCH_HISTORY_EVENTS) {
      expect(e.year, e.slug).toBeGreaterThanOrEqual(30);
      expect(e.year, e.slug).toBeLessThanOrEqual(CURRENT_YEAR);
      // An event dated exactly on an era boundary may close the era it ends
      // (John's death in 100, Westphalia in 1648, Vatican II's close in 1965)
      // rather than open the next one; anything else must match the year.
      const expectedEra = eraForYear(e.year);
      const boundary = HISTORY_ERAS.find((era) => era.from === e.year);
      const previous = boundary ? HISTORY_ERAS[HISTORY_ERAS.indexOf(boundary) - 1]?.key : undefined;
      expect([expectedEra, previous].includes(e.era), `${e.slug}: ${e.era}`).toBe(true);
      if (e.precision === "day") {
        expect(e.date, e.slug).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(Number(e.date!.slice(0, 4)), e.slug).toBe(e.year);
        const [, m, d] = e.date!.split("-").map(Number);
        expect(m, e.slug).toBeGreaterThanOrEqual(1);
        expect(m, e.slug).toBeLessThanOrEqual(12);
        expect(d, e.slug).toBeGreaterThanOrEqual(1);
        expect(d, e.slug).toBeLessThanOrEqual(31);
      } else {
        // A date is stored only when the exact day is well attested.
        expect(e.date, e.slug).toBeUndefined();
      }
      expect(e.title.trim(), e.slug).not.toBe("");
      expect(e.context.trim(), e.slug).not.toBe("");
      expect(e.significance.trim(), e.slug).not.toBe("");
    }
  });

  it("cites one https page on an allowed host", () => {
    for (const e of CHURCH_HISTORY_EVENTS) {
      const url = new URL(e.citation);
      expect(url.protocol, e.slug).toBe("https:");
      expect(HISTORY_CITATION_HOSTS.has(url.host), `${e.slug}: ${url.host}`).toBe(true);
    }
  });

  it("links only to slugs that exist in the curated knowledge base", () => {
    const documents = new Set([
      ...slugsOf(churchHistoryKnowledge),
      ...slugsOf(churchDocumentKnowledge),
    ]);
    const popes = slugsOf(popeKnowledge);
    const saints = slugsOf(saintKnowledge);
    const doctors = slugsOf(doctorKnowledge);
    const apparitions = slugsOf(apparitionKnowledge);
    for (const e of CHURCH_HISTORY_EVENTS) {
      const links = e.links;
      if (!links) continue;
      if (links.documentSlug) {
        expect(documents.has(links.documentSlug), `${e.slug} → ${links.documentSlug}`).toBe(true);
      }
      for (const s of links.popes ?? []) expect(popes.has(s), `${e.slug} → ${s}`).toBe(true);
      for (const s of links.saints ?? []) expect(saints.has(s), `${e.slug} → ${s}`).toBe(true);
      for (const s of links.doctors ?? []) expect(doctors.has(s), `${e.slug} → ${s}`).toBe(true);
      for (const s of links.apparitions ?? []) {
        expect(apparitions.has(s), `${e.slug} → ${s}`).toBe(true);
      }
    }
  });

  it("carries all 21 ecumenical councils as council events linked to their document", () => {
    const councils = CHURCH_HISTORY_EVENTS.filter(
      (e) =>
        e.kind === "council" &&
        e.links?.documentSlug &&
        slugsOf(churchHistoryKnowledge).has(e.links.documentSlug),
    );
    const linked = new Set(councils.map((e) => e.links!.documentSlug!));
    for (const council of churchHistoryKnowledge) {
      expect(linked.has(council.slug), council.slug).toBe(true);
    }
    const nicaea = CHURCH_HISTORY_EVENTS.find((e) => e.slug === "first-council-of-nicaea");
    expect(nicaea).toMatchObject({ year: 325, date: "0325-05-20", precision: "day" });
    expect(formatHistoryDate(nicaea!)).toBe("20 May 325");
  });

  it("populates every era and every timeline filter", () => {
    const { events } = buildTimeline([]);
    for (const era of HISTORY_ERAS) {
      const n = events.filter((e) => e.era === era.key).length;
      expect(n, era.key).toBeGreaterThanOrEqual(8);
    }
    for (const key of Object.keys(FILTER_LABELS) as Array<keyof typeof FILTER_LABELS>) {
      const n = events.filter((e) => matchesHistoryFilter(e, key)).length;
      expect(n, key).toBeGreaterThan(0);
    }
  });
});

describe("history helpers", () => {
  it("formats dates by precision", () => {
    expect(formatHistoryDate({ year: 33, precision: "circa" })).toBe("c. 33");
    expect(formatHistoryDate({ year: 381, precision: "year" })).toBe("381");
    expect(formatHistoryDate({ year: 1962, precision: "day", date: "1962-10-11" })).toBe(
      "11 October 1962",
    );
    // A malformed day falls back to the year rather than showing raw ISO.
    expect(formatHistoryDate({ year: 1962, precision: "day", date: "1962-10" })).toBe("1962");
  });

  it("sorts circa before year-only before dated events of the same year", () => {
    const circa = historySortKey({ year: 64, precision: "circa" });
    const year = historySortKey({ year: 64, precision: "year" });
    const day = historySortKey({ year: 64, precision: "day", date: "0064-07-18" });
    expect(circa < year && year < day).toBe(true);
    expect(historySortKey({ year: 325, precision: "year" }) < year).toBe(false);
  });

  it("assigns eras by year at the boundaries", () => {
    expect(eraForYear(33)).toBe("apostolic");
    expect(eraForYear(100)).toBe("persecution");
    expect(eraForYear(313)).toBe("fathers");
    expect(eraForYear(1054)).toBe("high-medieval");
    expect(eraForYear(1517)).toBe("reformation-trent");
    expect(eraForYear(1965)).toBe("post-conciliar");
    expect(eraForYear(2100)).toBe("post-conciliar");
  });
});
