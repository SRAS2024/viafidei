/**
 * Duplicate detection. Catches "Our Father" vs "Lord's Prayer" vs "Pater
 * Noster", "Saint Therese" vs "Saint Theresa of Lisieux", and similar
 * near-collisions across checklist items and built content.
 */

import type { ChecklistContentType, PrismaClient } from "@prisma/client";

import { canonicalizeSlug, normalizeForComparison } from "../slugs";

export interface DuplicateMatch {
  matchedItemId: string;
  matchedSlug: string;
  matchedName: string;
  matchType: "slug" | "alias" | "name" | "normalized_name";
  confidence: number;
}

export interface DuplicateDetectionInput {
  contentType: ChecklistContentType;
  canonicalName: string;
  canonicalSlug: string;
  aliases?: string[];
  excludeChecklistItemId?: string;
}

/**
 * Detect duplicate checklist items by content type, normalized slug, and
 * normalized name including aliases. Returns the best match (or null).
 */
export async function detectChecklistDuplicate(
  prisma: PrismaClient,
  input: DuplicateDetectionInput,
): Promise<DuplicateMatch | null> {
  const slug = canonicalizeSlug(input.canonicalSlug);
  const normName = normalizeForComparison(input.canonicalName);
  const normAliases = (input.aliases ?? []).map(normalizeForComparison);

  const candidates = await prisma.checklistItem.findMany({
    where: {
      contentType: input.contentType,
      ...(input.excludeChecklistItemId ? { id: { not: input.excludeChecklistItemId } } : {}),
    },
    select: {
      id: true,
      canonicalName: true,
      canonicalSlug: true,
      aliases: true,
    },
  });

  for (const candidate of candidates) {
    if (canonicalizeSlug(candidate.canonicalSlug) === slug) {
      return {
        matchedItemId: candidate.id,
        matchedSlug: candidate.canonicalSlug,
        matchedName: candidate.canonicalName,
        matchType: "slug",
        confidence: 1,
      };
    }
  }
  for (const candidate of candidates) {
    const candidateName = normalizeForComparison(candidate.canonicalName);
    if (candidateName === normName) {
      return {
        matchedItemId: candidate.id,
        matchedSlug: candidate.canonicalSlug,
        matchedName: candidate.canonicalName,
        matchType: "normalized_name",
        confidence: 0.95,
      };
    }
  }
  for (const candidate of candidates) {
    const candidateAliases = candidate.aliases.map(normalizeForComparison);
    if (candidateAliases.some((a) => a === normName || normAliases.includes(a))) {
      return {
        matchedItemId: candidate.id,
        matchedSlug: candidate.canonicalSlug,
        matchedName: candidate.canonicalName,
        matchType: "alias",
        confidence: 0.9,
      };
    }
    if (normAliases.includes(normalizeForComparison(candidate.canonicalName))) {
      return {
        matchedItemId: candidate.id,
        matchedSlug: candidate.canonicalSlug,
        matchedName: candidate.canonicalName,
        matchType: "alias",
        confidence: 0.9,
      };
    }
  }
  return null;
}

/**
 * Hash-based duplicate detection for content packages. Two packages with
 * the same content checksum are duplicates regardless of slug.
 */
export function packagesAreDuplicates(
  a: { contentChecksum?: string | null; title?: string | null },
  b: { contentChecksum?: string | null; title?: string | null },
): boolean {
  if (a.contentChecksum && b.contentChecksum) {
    return a.contentChecksum === b.contentChecksum;
  }
  if (a.title && b.title) {
    return normalizeForComparison(a.title) === normalizeForComparison(b.title);
  }
  return false;
}
