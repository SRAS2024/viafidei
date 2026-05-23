#!/usr/bin/env tsx
/**
 * Migration: legacy scraper data → checklist-first architecture.
 *
 * Steps:
 *   1. Seed the authority source registry and master checklists.
 *   2. Translate every existing published Prayer/Saint/Devotion/etc. row
 *      into a ChecklistItem + PublishedContent.
 *   3. Preserve existing slugs whenever possible to keep public URLs stable.
 *   4. Drop legacy ingestion queue entries (the old scraper queue is no
 *      longer scheduled — the new worker queue replaces it).
 *
 * Idempotent. Re-run after every deploy until the legacy tables empty.
 */

import { PrismaClient, type ChecklistContentType } from "@prisma/client";

import { seedChecklistFirst } from "../src/lib/worker/seed";
import { canonicalizeSlug } from "../src/lib/worker";

const prisma = new PrismaClient();

interface LegacyRow {
  id: string;
  slug: string;
  title: string;
  payload: Record<string, unknown>;
  sourceUrl?: string | null;
  sourceHost?: string | null;
  status: string;
}

async function importLegacyType<T extends { id: string; slug: string }>(
  contentType: ChecklistContentType,
  rows: T[],
  toLegacy: (row: T) => LegacyRow,
): Promise<number> {
  let imported = 0;
  for (const row of rows) {
    const legacy = toLegacy(row);
    const slug = canonicalizeSlug(legacy.slug) || canonicalizeSlug(legacy.title);
    if (!slug) continue;
    const checklistItem = await prisma.checklistItem.upsert({
      where: {
        contentType_canonicalSlug: { contentType, canonicalSlug: slug },
      },
      update: {
        canonicalName: legacy.title,
      },
      create: {
        contentType,
        canonicalName: legacy.title,
        canonicalSlug: slug,
        approvalStatus: legacy.status === "PUBLISHED" ? "PUBLISHED" : "APPROVED",
        publishedAt: legacy.status === "PUBLISHED" ? new Date() : null,
        notes: "Migrated from legacy scraper data.",
      },
    });

    if (legacy.status === "PUBLISHED") {
      await prisma.publishedContent.upsert({
        where: { checklistItemId: checklistItem.id },
        update: {
          payload: legacy.payload as never,
          isPublished: true,
        },
        create: {
          checklistItemId: checklistItem.id,
          contentType,
          slug,
          title: legacy.title,
          payload: legacy.payload as never,
          authorityLevel: "TRUSTED_PUBLISHER",
          isPublished: true,
          publishedAt: new Date(),
        },
      });
    }
    if (legacy.sourceUrl && legacy.sourceHost) {
      await prisma.checklistCitation
        .upsert({
          where: {
            checklistItemId_sourceUrl: {
              checklistItemId: checklistItem.id,
              sourceUrl: legacy.sourceUrl,
            },
          },
          update: {},
          create: {
            checklistItemId: checklistItem.id,
            sourceUrl: legacy.sourceUrl,
            sourceHost: legacy.sourceHost,
            authorityLevel: "TRUSTED_PUBLISHER",
            validated: legacy.status === "PUBLISHED",
            validatedAt: legacy.status === "PUBLISHED" ? new Date() : null,
          },
        })
        .catch(() => undefined);
    }
    imported++;
  }
  return imported;
}

async function main() {
  console.log("→ Seeding checklist-first system (authority sources + master checklists)");
  const seedResult = await seedChecklistFirst(prisma);
  console.log("  seedResult:", seedResult);

  console.log("→ Migrating legacy Prayer rows");
  const prayers = await prisma.prayer.findMany({});
  const prayersImported = await importLegacyType("PRAYER", prayers, (p) => ({
    id: p.id,
    slug: p.slug,
    title: p.defaultTitle,
    payload: {
      slug: p.slug,
      title: p.defaultTitle,
      body: p.body,
      prayerType: p.prayerType ?? "general",
      category: p.category,
      language: p.language ?? "en",
      citations: p.sourceUrl ? [p.sourceUrl] : [],
    },
    sourceUrl: p.sourceUrl,
    sourceHost: p.sourceHost,
    status: p.status,
  }));
  console.log(`  prayers migrated: ${prayersImported}`);

  console.log("→ Migrating legacy Saint rows");
  const saints = await prisma.saint.findMany({});
  const saintsImported = await importLegacyType("SAINT", saints, (s) => ({
    id: s.id,
    slug: s.slug,
    title: s.canonicalName,
    payload: {
      slug: s.slug,
      canonicalName: s.canonicalName,
      biography: s.biography,
      feastDay: s.feastDay ?? "01-01",
      feastMonth: s.feastMonth ?? 1,
      feastDayOfMonth: s.feastDayOfMonth ?? 1,
      patronages: s.patronages ?? [],
      saintType: s.saintType ?? "other",
      canonizationStatus: "canonized",
      citations: s.sourceUrl ? [s.sourceUrl] : [],
    },
    sourceUrl: s.sourceUrl,
    sourceHost: s.sourceHost,
    status: s.status,
  }));
  console.log(`  saints migrated: ${saintsImported}`);

  console.log("→ Migrating legacy Devotion rows");
  const devotions = await prisma.devotion.findMany({});
  const devotionsImported = await importLegacyType("DEVOTION", devotions, (d) => ({
    id: d.id,
    slug: d.slug,
    title: d.title,
    payload: {
      slug: d.slug,
      title: d.title,
      summary: d.summary,
      devotionType: d.devotionType ?? "marian",
      practiceInstructions: d.practiceInstructions ?? d.practiceText ?? "",
      citations: d.sourceUrl ? [d.sourceUrl] : [],
    },
    sourceUrl: d.sourceUrl,
    sourceHost: d.sourceHost,
    status: d.status,
  }));
  console.log(`  devotions migrated: ${devotionsImported}`);

  console.log("→ Migrating legacy MarianApparition rows");
  const apparitions = await prisma.marianApparition.findMany({});
  const apparitionsImported = await importLegacyType("APPARITION", apparitions, (a) => ({
    id: a.id,
    slug: a.slug,
    title: a.title,
    payload: {
      slug: a.slug,
      title: a.title,
      location: a.location ?? "Unknown",
      country: a.country ?? "Unknown",
      approvedStatus: a.approvedStatus ?? "not_yet_judged",
      summary: a.summary,
      citations: a.sourceUrl ? [a.sourceUrl] : [],
    },
    sourceUrl: a.sourceUrl,
    sourceHost: a.sourceHost,
    status: a.status,
  }));
  console.log(`  apparitions migrated: ${apparitionsImported}`);

  console.log("→ Migrating legacy LiturgyEntry rows");
  const liturgyEntries = await prisma.liturgyEntry.findMany({});
  const liturgyImported = await importLegacyType("LITURGICAL", liturgyEntries, (l) => ({
    id: l.id,
    slug: l.slug,
    title: l.title,
    payload: {
      slug: l.slug,
      title: l.title,
      summary: l.summary ?? "",
      body: l.body,
      kind: l.kind === "GENERAL" ? "feast" : l.kind.toLowerCase(),
      citations: l.sourceUrl ? [l.sourceUrl] : [],
    },
    sourceUrl: l.sourceUrl,
    sourceHost: l.sourceHost,
    status: l.status,
  }));
  console.log(`  liturgy entries migrated: ${liturgyImported}`);

  console.log("→ Migrating legacy SpiritualLifeGuide rows");
  const guides = await prisma.spiritualLifeGuide.findMany({});
  const guidesImported = await importLegacyType("GUIDE", guides, (g) => ({
    id: g.id,
    slug: g.slug,
    title: g.title,
    payload: {
      slug: g.slug,
      title: g.title,
      summary: g.summary,
      kind: "general",
      steps: Array.isArray(g.steps) ? g.steps : [],
      citations: g.sourceUrl ? [g.sourceUrl] : [],
    },
    sourceUrl: g.sourceUrl,
    sourceHost: g.sourceHost,
    status: g.status,
  }));
  console.log(`  guides migrated: ${guidesImported}`);

  console.log("→ Clearing legacy scraper queue rows");
  const queueDeleted = await prisma.ingestionJobQueue.deleteMany({
    where: {
      status: { in: ["pending", "retrying", "failed"] },
    },
  });
  console.log(`  removed ${queueDeleted.count} legacy queue rows`);

  console.log("→ Done");
}

main()
  .catch((err) => {
    console.error("[migrate] fatal:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
