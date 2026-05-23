/**
 * Seeds the checklist-first system.
 *
 *   - Loads the AuthoritySource registry (idempotent).
 *   - Loads every master checklist into the ChecklistItem table.
 *   - Adds seed citations for items that ship them.
 *
 * Re-running this is safe: every upsert is keyed by canonicalSlug/host.
 */

import type { ChecklistContentType, PrismaClient } from "@prisma/client";

import { MASTER_CHECKLISTS } from "./checklists";
import { AUTHORITY_SOURCES } from "./sources/authority-registry";
import { canonicalizeSlug } from "./slugs";

export interface SeedResult {
  authoritySourcesInserted: number;
  authoritySourcesUpdated: number;
  checklistItemsInserted: number;
  checklistItemsUpdated: number;
  citationsInserted: number;
  citationsUpdated: number;
}

export async function seedChecklistFirst(prisma: PrismaClient): Promise<SeedResult> {
  const result: SeedResult = {
    authoritySourcesInserted: 0,
    authoritySourcesUpdated: 0,
    checklistItemsInserted: 0,
    checklistItemsUpdated: 0,
    citationsInserted: 0,
    citationsUpdated: 0,
  };

  for (const seed of AUTHORITY_SOURCES) {
    const existing = await prisma.authoritySource.findUnique({
      where: { host: seed.host },
    });
    await prisma.authoritySource.upsert({
      where: { host: seed.host },
      update: {
        name: seed.name,
        baseUrl: seed.baseUrl,
        authorityLevel: seed.authorityLevel,
        description: seed.description,
        contentTypes: seed.contentTypes,
      },
      create: {
        name: seed.name,
        host: seed.host,
        baseUrl: seed.baseUrl,
        authorityLevel: seed.authorityLevel,
        description: seed.description,
        contentTypes: seed.contentTypes,
      },
    });
    if (existing) result.authoritySourcesUpdated++;
    else result.authoritySourcesInserted++;
  }

  for (const [contentType, list] of Object.entries(MASTER_CHECKLISTS)) {
    const type = contentType as ChecklistContentType;
    for (const seed of list) {
      const slug = canonicalizeSlug(seed.canonicalSlug);
      const existing = await prisma.checklistItem.findFirst({
        where: { contentType: type, canonicalSlug: slug },
      });
      const item = await prisma.checklistItem.upsert({
        where: {
          contentType_canonicalSlug: { contentType: type, canonicalSlug: slug },
        },
        update: {
          canonicalName: seed.canonicalName,
          aliases: seed.aliases ?? [],
          summary: seed.summary,
          priority: seed.priority ?? 100,
          needsHumanReview: seed.needsHumanReview ?? false,
          humanReviewReason: seed.humanReviewReason,
          authorityLevelHint: seed.authorityLevelHint,
          notes: seed.notes,
          metadata: (seed.metadata ?? undefined) as never,
        },
        create: {
          contentType: type,
          canonicalName: seed.canonicalName,
          canonicalSlug: slug,
          aliases: seed.aliases ?? [],
          summary: seed.summary,
          priority: seed.priority ?? 100,
          needsHumanReview: seed.needsHumanReview ?? false,
          humanReviewReason: seed.humanReviewReason,
          authorityLevelHint: seed.authorityLevelHint,
          notes: seed.notes,
          metadata: (seed.metadata ?? undefined) as never,
          approvalStatus: "DISCOVERED",
        },
      });
      if (existing) result.checklistItemsUpdated++;
      else result.checklistItemsInserted++;

      if (seed.seedCitations?.length) {
        for (const cite of seed.seedCitations) {
          const host = (() => {
            try {
              return new URL(cite.sourceUrl).host;
            } catch {
              return "";
            }
          })();
          if (!host) continue;
          const authoritySource = await prisma.authoritySource.findUnique({
            where: { host },
          });
          const existingCit = await prisma.checklistCitation.findUnique({
            where: {
              checklistItemId_sourceUrl: {
                checklistItemId: item.id,
                sourceUrl: cite.sourceUrl,
              },
            },
          });
          await prisma.checklistCitation.upsert({
            where: {
              checklistItemId_sourceUrl: {
                checklistItemId: item.id,
                sourceUrl: cite.sourceUrl,
              },
            },
            update: {
              authorityLevel: cite.authorityLevel,
              title: cite.title,
              authoritySourceId: authoritySource?.id,
            },
            create: {
              checklistItemId: item.id,
              sourceUrl: cite.sourceUrl,
              sourceHost: host,
              authorityLevel: cite.authorityLevel,
              title: cite.title,
              authoritySourceId: authoritySource?.id,
            },
          });
          if (existingCit) result.citationsUpdated++;
          else result.citationsInserted++;
        }
      }
    }
  }
  return result;
}
