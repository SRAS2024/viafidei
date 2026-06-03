import { parseYear } from "@/lib/content-shared/saints";
import type { PublishedItem } from "@/lib/data/published";

import type { HistoryEvent } from "./HistoryTimelineClient";

/**
 * Maps published Church documents onto the Church-history timeline. The
 * Church's story is told through her councils and magisterial documents:
 * each document becomes a dated timeline event, placed by its issue year.
 */
const DOC_TYPE_LABELS: Record<string, string> = {
  encyclical: "Encyclical",
  apostolic_exhortation: "Apostolic Exhortation",
  apostolic_constitution: "Apostolic Constitution",
  motu_proprio: "Motu Proprio",
  apostolic_letter: "Apostolic Letter",
  decree: "Decree",
  declaration: "Declaration",
  council_document: "Council Document",
  catechism_section: "Catechism",
  instruction: "Instruction",
  vatican_document: "Vatican Document",
  uscb_pastoral_letter: "USCCB Pastoral Letter",
};

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

export function toHistoryEvents(items: PublishedItem[]): HistoryEvent[] {
  const events: HistoryEvent[] = [];
  for (const item of items) {
    const p = item.payload;
    const issued = str(p.issuedDate);
    const year = parseYear(issued);
    if (year == null) continue; // a document needs a year to sit on the timeline
    const documentType = str(p.documentType);
    const themes = Array.isArray(p.keyThemes)
      ? (p.keyThemes.filter((x) => typeof x === "string") as string[])
      : [];
    events.push({
      slug: item.slug,
      title: item.title,
      date: issued ?? String(year),
      sortYear: year,
      period: documentType ?? "document",
      periodLabel: (documentType && DOC_TYPE_LABELS[documentType]) || "Document",
      documentType,
      context: str(p.issuingAuthority),
      significance: themes.length ? themes.join(", ") : undefined,
      body: str(p.bodyExcerpt) ?? str(p.summary),
    });
  }
  return events.sort((a, b) => b.sortYear - a.sortYear);
}

/**
 * Slider bounds for the timeline: from Christ's ministry (≈30 AD) to the
 * current year, widened if any event falls outside that range.
 */
export function historyYearBounds(
  events: HistoryEvent[],
  floor = 30,
): { minYear: number; maxYear: number } {
  const currentYear = new Date().getUTCFullYear();
  if (events.length === 0) return { minYear: floor, maxYear: currentYear };
  const years = events.map((e) => e.sortYear);
  return {
    minYear: Math.min(floor, ...years),
    maxYear: Math.max(currentYear, ...years),
  };
}
