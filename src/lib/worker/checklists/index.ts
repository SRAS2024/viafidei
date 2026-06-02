/**
 * Master checklists — curated lists of every item the Viafidei app intends
 * to publish, by content type. The list is the source of truth: anything not
 * on a checklist will not be built or published, period.
 *
 * Each entry seeds a ChecklistItem row when the checklist seed runs.
 * Admins can add, remove, or annotate items; the worker only acts on rows
 * that exist here or were added through the admin UI.
 */

import type { ChecklistContentType, SourceAuthorityLevel } from "@prisma/client";

import { prayersChecklist } from "./prayers";
import { devotionsChecklist } from "./devotions";
import { saintsChecklist } from "./saints";
import { marianTitlesChecklist } from "./marian-titles";
import { apparitionsChecklist } from "./apparitions";
import { novenasChecklist } from "./novenas";
import { sacramentsChecklist } from "./sacraments";
import { guidesChecklist } from "./guides";
import { churchDocumentsChecklist } from "./church-documents";
import { liturgicalChecklist } from "./liturgical";
import { spiritualPracticesChecklist } from "./spiritual-practices";
import { parishesChecklist } from "./parishes";

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
};

export function totalChecklistItems(): number {
  return Object.values(MASTER_CHECKLISTS).reduce((sum, list) => sum + list.length, 0);
}

export function checklistSummary(): Record<ChecklistContentType, number> {
  return Object.fromEntries(
    Object.entries(MASTER_CHECKLISTS).map(([type, list]) => [type, list.length]),
  ) as Record<ChecklistContentType, number>;
}
