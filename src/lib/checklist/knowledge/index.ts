/**
 * Curated knowledge base.
 *
 * The worker uses this as its first-pass content source for the most
 * fundamental Catholic items (Our Father, Hail Mary, the seven sacraments,
 * the Catechism's basic teachings, major feasts, the most popular saints,
 * etc.). These are doctrinally fixed texts the Church has used for centuries
 * — they do not change source-to-source, so it would be silly to depend on a
 * network fetch every time the worker builds them.
 *
 * Each entry includes:
 *   - the canonical slug (matches the master checklist slug)
 *   - a complete payload the worker can validate against the strict schema
 *   - the citation URLs the payload was sourced from
 *   - the authority level for those citations
 *
 * When the build engine processes a checklist item whose slug is in this
 * registry it uses the curated payload directly (instead of fetching). The
 * engine still runs cross-source validation: any extra approved citation the
 * admin attached is fetched and compared. This gives the worker the best of
 * both worlds: instant production-quality content for the canonical items
 * plus live source verification when admins want it.
 */

import type { ChecklistContentType, SourceAuthorityLevel } from "@prisma/client";

import { prayerKnowledge } from "./prayers";
import { sacramentKnowledge } from "./sacraments";
import { saintKnowledge } from "./saints";
import { marianTitleKnowledge } from "./marian-titles";
import { devotionKnowledge } from "./devotions";
import { liturgicalKnowledge } from "./liturgical";
import { spiritualPracticeKnowledge } from "./spiritual-practices";
import { guideKnowledge } from "./guides";
import { novenaKnowledge } from "./novenas";
import { apparitionKnowledge } from "./apparitions";
import { churchDocumentKnowledge } from "./church-documents";
import { churchHistoryKnowledge } from "./church-history";
import { doctorKnowledge } from "./doctors";
import { popeKnowledge } from "./popes";
import { riteKnowledge } from "./rites";
import { parishKnowledge } from "./parishes";
import { litanyKnowledge } from "./litanies";

export interface CuratedEntry {
  contentType: ChecklistContentType;
  slug: string;
  authorityLevel: SourceAuthorityLevel;
  citations: string[];
  payload: Record<string, unknown>;
}

const ALL: CuratedEntry[] = [
  ...prayerKnowledge,
  ...sacramentKnowledge,
  ...saintKnowledge,
  ...marianTitleKnowledge,
  ...devotionKnowledge,
  ...liturgicalKnowledge,
  ...spiritualPracticeKnowledge,
  ...guideKnowledge,
  ...novenaKnowledge,
  ...apparitionKnowledge,
  ...churchDocumentKnowledge,
  ...churchHistoryKnowledge,
  ...doctorKnowledge,
  ...popeKnowledge,
  ...riteKnowledge,
  ...parishKnowledge,
  ...litanyKnowledge,
];

const INDEX = new Map<string, CuratedEntry>();
for (const entry of ALL) {
  INDEX.set(`${entry.contentType}:${entry.slug}`, entry);
}

export function findCuratedEntry(
  contentType: ChecklistContentType,
  slug: string,
): CuratedEntry | undefined {
  return INDEX.get(`${contentType}:${slug}`);
}

export function curatedKnowledgeSize(): number {
  return ALL.length;
}

export function curatedKnowledgeByType(): Record<ChecklistContentType, number> {
  const out: Partial<Record<ChecklistContentType, number>> = {};
  for (const entry of ALL) {
    out[entry.contentType] = (out[entry.contentType] ?? 0) + 1;
  }
  return out as Record<ChecklistContentType, number>;
}

export { ALL as ALL_CURATED_ENTRIES };
