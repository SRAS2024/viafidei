/**
 * Master checklists — the list of every item the Viafidei app intends to
 * publish, by content type. The list is the source of truth: anything not on
 * a checklist will not be built or published, period.
 *
 * Each checklist is DERIVED from the curated knowledge base (one seed per
 * curated entry, carrying the entry's citations — see `from-curated.ts`) plus
 * a short, explicit allow-list of hand-written extras for items intentionally
 * not curated yet (`CHECKLIST_EXTRAS`). A test enforces that every checklist
 * slug is either curated or on that allow-list, so the two can never drift.
 *
 * Each entry seeds a ChecklistItem row when the checklist seed runs.
 * Admins can add, remove, or annotate items; the worker only acts on rows
 * that exist here or were added through the admin UI.
 */

import type { ChecklistContentType, SourceAuthorityLevel } from "@prisma/client";

import { prayersChecklist, prayersExtras } from "./prayers";
import { devotionsChecklist, devotionsExtras } from "./devotions";
import { saintsChecklist, saintsExtras } from "./saints";
import { marianTitlesChecklist, marianTitlesExtras } from "./marian-titles";
import { apparitionsChecklist, apparitionsExtras } from "./apparitions";
import { novenasChecklist, novenasExtras } from "./novenas";
import { sacramentsChecklist, sacramentsExtras } from "./sacraments";
import { guidesChecklist, guidesExtras } from "./guides";
import { churchDocumentsChecklist, churchDocumentsExtras } from "./church-documents";
import { liturgicalChecklist, liturgicalExtras } from "./liturgical";
import { spiritualPracticesChecklist, spiritualPracticesExtras } from "./spiritual-practices";
import { parishesChecklist, parishesExtras } from "./parishes";
import { popesChecklist, popesExtras } from "./popes";
import { doctorsChecklist, doctorsExtras } from "./doctors";
import { ritesChecklist, ritesExtras } from "./rites";

export interface ChecklistSeed {
  canonicalName: string;
  canonicalSlug: string;
  aliases?: string[];
  summary?: string;
  priority?: number;
  needsHumanReview?: boolean;
  humanReviewReason?: string;
  authorityLevelHint?: SourceAuthorityLevel;
  notes?: string;
  seedCitations?: Array<{
    sourceUrl: string;
    authorityLevel: SourceAuthorityLevel;
    title?: string;
  }>;
  metadata?: Record<string, unknown>;
}

export const MASTER_CHECKLISTS: Record<ChecklistContentType, ChecklistSeed[]> = {
  PRAYER: prayersChecklist,
  DEVOTION: devotionsChecklist,
  SAINT: saintsChecklist,
  MARIAN_TITLE: marianTitlesChecklist,
  APPARITION: apparitionsChecklist,
  NOVENA: novenasChecklist,
  SACRAMENT: sacramentsChecklist,
  GUIDE: guidesChecklist,
  CHURCH_DOCUMENT: churchDocumentsChecklist,
  LITURGICAL: liturgicalChecklist,
  SPIRITUAL_PRACTICE: spiritualPracticesChecklist,
  PARISH: parishesChecklist,
  POPE: popesChecklist,
  DOCTOR: doctorsChecklist,
  RITE: ritesChecklist,
};

/**
 * The explicit allow-list: hand-written seeds for items intentionally NOT in
 * the curated registry. Every checklist slug that is not curated must be here.
 */
export const CHECKLIST_EXTRAS: Record<ChecklistContentType, ChecklistSeed[]> = {
  PRAYER: prayersExtras,
  DEVOTION: devotionsExtras,
  SAINT: saintsExtras,
  MARIAN_TITLE: marianTitlesExtras,
  APPARITION: apparitionsExtras,
  NOVENA: novenasExtras,
  SACRAMENT: sacramentsExtras,
  GUIDE: guidesExtras,
  CHURCH_DOCUMENT: churchDocumentsExtras,
  LITURGICAL: liturgicalExtras,
  SPIRITUAL_PRACTICE: spiritualPracticesExtras,
  PARISH: parishesExtras,
  POPE: popesExtras,
  DOCTOR: doctorsExtras,
  RITE: ritesExtras,
};

export { curatedChecklist, seedFromCurated, uncuratedExtras } from "./from-curated";

export function totalChecklistItems(): number {
  return Object.values(MASTER_CHECKLISTS).reduce((sum, list) => sum + list.length, 0);
}

export function checklistSummary(): Record<ChecklistContentType, number> {
  return Object.fromEntries(
    Object.entries(MASTER_CHECKLISTS).map(([type, list]) => [type, list.length]),
  ) as Record<ChecklistContentType, number>;
}
