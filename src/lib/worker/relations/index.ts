/**
 * Content relationship mapper.
 *
 * After a checklist item is built, the worker examines its payload for
 * references to other checklist items and creates typed relations:
 *   saint --HAS_FEAST_DAY--> liturgical
 *   devotion --USES_PRAYER--> prayer
 *   novena --HONORS_SAINT--> saint
 *   marian_title --LINKED_TO_APPARITION--> apparition
 *   guide --COVERS_SACRAMENT--> sacrament
 *   apparition --ASSOCIATED_WITH_MARIAN_TITLE--> marian_title
 */

import type { ChecklistContentType, PrismaClient } from "@prisma/client";

import { canonicalizeSlug } from "../slugs";

export type RelationType =
  | "HAS_FEAST_DAY"
  | "USES_PRAYER"
  | "HONORS_SAINT"
  | "LINKED_TO_APPARITION"
  | "ASSOCIATED_WITH_MARIAN_TITLE"
  | "COVERS_SACRAMENT"
  | "DERIVED_FROM_DOCUMENT"
  | "REFERENCES_SCRIPTURE"
  | "PART_OF_TRADITION";

export interface RelationCandidate {
  fromSlug: string;
  toSlug: string;
  toType: ChecklistContentType;
  relationType: RelationType;
  notes?: string;
}

export interface RelationExtractionInput {
  fromItemId: string;
  fromType: ChecklistContentType;
  payload: Record<string, unknown>;
}

/**
 * Inspect a built content payload and return a list of relation candidates.
 * The mapper is conservative: it only emits a candidate when the payload
 * names a slug or matching name in a known relation field.
 */
export function extractRelationCandidates(input: RelationExtractionInput): RelationCandidate[] {
  const out: RelationCandidate[] = [];
  const { fromType, payload } = input;
  const pickSlug = (val: unknown): string | null => {
    if (typeof val !== "string") return null;
    const slug = canonicalizeSlug(val);
    return slug || null;
  };
  const pickList = (val: unknown): string[] => {
    if (!Array.isArray(val)) return [];
    return val
      .map((entry) => (typeof entry === "string" ? canonicalizeSlug(entry) : null))
      .filter((slug): slug is string => !!slug);
  };

  switch (fromType) {
    case "SAINT": {
      const feastSlug = pickSlug(payload.feastDaySlug);
      if (feastSlug) {
        out.push({
          fromSlug: "",
          toSlug: feastSlug,
          toType: "LITURGICAL",
          relationType: "HAS_FEAST_DAY",
        });
      }
      for (const slug of pickList(payload.relatedPrayers)) {
        out.push({
          fromSlug: "",
          toSlug: slug,
          toType: "PRAYER",
          relationType: "USES_PRAYER",
        });
      }
      for (const slug of pickList(payload.relatedDevotions)) {
        out.push({
          fromSlug: "",
          toSlug: slug,
          toType: "DEVOTION",
          relationType: "PART_OF_TRADITION",
        });
      }
      break;
    }
    case "DEVOTION":
    case "NOVENA": {
      for (const slug of pickList(payload.relatedPrayers)) {
        out.push({
          fromSlug: "",
          toSlug: slug,
          toType: "PRAYER",
          relationType: "USES_PRAYER",
        });
      }
      const associatedSaint = pickSlug(payload.associatedSaintSlug);
      if (associatedSaint) {
        out.push({
          fromSlug: "",
          toSlug: associatedSaint,
          toType: "SAINT",
          relationType: "HONORS_SAINT",
        });
      }
      break;
    }
    case "MARIAN_TITLE": {
      const associatedApparition = pickSlug(payload.associatedApparitionSlug);
      if (associatedApparition) {
        out.push({
          fromSlug: "",
          toSlug: associatedApparition,
          toType: "APPARITION",
          relationType: "LINKED_TO_APPARITION",
        });
      }
      for (const slug of pickList(payload.associatedPrayers)) {
        out.push({
          fromSlug: "",
          toSlug: slug,
          toType: "PRAYER",
          relationType: "USES_PRAYER",
        });
      }
      break;
    }
    case "APPARITION": {
      const marianTitle = pickSlug(payload.associatedMarianTitleSlug);
      if (marianTitle) {
        out.push({
          fromSlug: "",
          toSlug: marianTitle,
          toType: "MARIAN_TITLE",
          relationType: "ASSOCIATED_WITH_MARIAN_TITLE",
        });
      }
      break;
    }
    case "GUIDE": {
      const sacrament = pickSlug(payload.sacramentKey);
      if (sacrament) {
        out.push({
          fromSlug: "",
          toSlug: sacrament,
          toType: "SACRAMENT",
          relationType: "COVERS_SACRAMENT",
        });
      }
      for (const slug of pickList(payload.relatedPrayers)) {
        out.push({
          fromSlug: "",
          toSlug: slug,
          toType: "PRAYER",
          relationType: "USES_PRAYER",
        });
      }
      break;
    }
    case "LITURGICAL": {
      for (const slug of pickList(payload.associatedSaintSlugs)) {
        out.push({
          fromSlug: "",
          toSlug: slug,
          toType: "SAINT",
          relationType: "HONORS_SAINT",
        });
      }
      break;
    }
    default:
      break;
  }
  return out;
}

/**
 * Persist relation candidates. Resolves slug → checklist item and creates
 * ChecklistRelation rows. Silently skips candidates whose target is not in
 * the master checklist (relation will be re-evaluated next build).
 */
export async function persistRelations(
  prisma: PrismaClient,
  fromItemId: string,
  candidates: RelationCandidate[],
): Promise<{ created: number; skipped: number }> {
  let created = 0;
  let skipped = 0;
  for (const candidate of candidates) {
    const target = await prisma.checklistItem.findFirst({
      where: { contentType: candidate.toType, canonicalSlug: candidate.toSlug },
      select: { id: true },
    });
    if (!target) {
      skipped++;
      continue;
    }
    await prisma.checklistRelation.upsert({
      where: {
        fromItemId_toItemId_relationType: {
          fromItemId,
          toItemId: target.id,
          relationType: candidate.relationType,
        },
      },
      update: { notes: candidate.notes },
      create: {
        fromItemId,
        toItemId: target.id,
        relationType: candidate.relationType,
        notes: candidate.notes,
      },
    });
    created++;
  }
  return { created, skipped };
}
