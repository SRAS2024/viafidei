// Imports only pure data arrays — no Prisma dependency in the imported files.
// This file is compiled into the Next.js server bundle at build time.
import { PRAYERS } from "../../../prisma/seeds/data/prayers";
import { SAINTS } from "../../../prisma/seeds/data/saints";
import { APPARITIONS } from "../../../prisma/seeds/data/apparitions";
import { DEVOTIONS } from "../../../prisma/seeds/data/devotions";
import { PARISHES } from "../../../prisma/seeds/data/parishes";
import { LITURGY_ENTRIES } from "../../../prisma/seeds/data/liturgyEntries";
import { SPIRITUAL_LIFE_GUIDES } from "../../../prisma/seeds/data/spiritualLifeGuides";
import { prisma } from "../db/client";
import { logger } from "../observability/logger";

export type StartupSeedSummary = {
  prayers: number;
  saints: number;
  apparitions: number;
  devotions: number;
  parishes: number;
  liturgyEntries: number;
  spiritualLifeGuides: number;
  failures: Array<{ table: string; slug: string; error: string }>;
};

/**
 * Idempotent seed: every entry is upserted by its unique slug, so calling
 * this against a fully populated DB is a no-op and against a partially
 * populated DB back-fills only the missing rows. Per-record errors are
 * captured into `failures` rather than aborted, so a single bad seed entry
 * doesn't stop the rest of the table from getting populated.
 */
export async function seedAllContent(): Promise<StartupSeedSummary> {
  const failures: StartupSeedSummary["failures"] = [];

  async function upsertOne<T extends { slug: string }>(
    table: string,
    item: T,
    fn: () => Promise<unknown>,
  ): Promise<boolean> {
    try {
      await fn();
      return true;
    } catch (error) {
      const msg = error instanceof Error ? error.message : "unknown";
      failures.push({ table, slug: item.slug, error: msg });
      logger.error("seed.upsert_failed", { table, slug: item.slug, error: msg });
      return false;
    }
  }

  let prayers = 0;
  for (const p of PRAYERS) {
    const ok = await upsertOne("Prayer", p, () =>
      prisma.prayer.upsert({
        where: { slug: p.slug },
        update: { status: "PUBLISHED", officialPrayer: p.officialPrayer ?? null },
        create: { ...p, officialPrayer: p.officialPrayer ?? null, status: "PUBLISHED" },
      }),
    );
    if (ok) prayers++;
  }

  let saints = 0;
  for (const s of SAINTS) {
    const ok = await upsertOne("Saint", s, () =>
      prisma.saint.upsert({
        where: { slug: s.slug },
        update: { status: "PUBLISHED" },
        create: { ...s, status: "PUBLISHED" },
      }),
    );
    if (ok) saints++;
  }

  let apparitions = 0;
  for (const a of APPARITIONS) {
    const ok = await upsertOne("MarianApparition", a, () =>
      prisma.marianApparition.upsert({
        where: { slug: a.slug },
        update: { status: "PUBLISHED" },
        create: { ...a, status: "PUBLISHED" },
      }),
    );
    if (ok) apparitions++;
  }

  let devotions = 0;
  for (const d of DEVOTIONS) {
    const ok = await upsertOne("Devotion", d, () =>
      prisma.devotion.upsert({
        where: { slug: d.slug },
        update: { status: "PUBLISHED" },
        create: { ...d, status: "PUBLISHED" },
      }),
    );
    if (ok) devotions++;
  }

  let parishes = 0;
  for (const p of PARISHES) {
    const ok = await upsertOne("Parish", p, () =>
      prisma.parish.upsert({
        where: { slug: p.slug },
        update: { status: "PUBLISHED" },
        create: { ...p, status: "PUBLISHED" },
      }),
    );
    if (ok) parishes++;
  }

  let liturgyEntries = 0;
  for (const e of LITURGY_ENTRIES) {
    const ok = await upsertOne("LiturgyEntry", e, () =>
      prisma.liturgyEntry.upsert({
        where: { slug: e.slug },
        update: { status: "PUBLISHED" },
        create: { ...e, status: "PUBLISHED" },
      }),
    );
    if (ok) liturgyEntries++;
  }

  let spiritualLifeGuides = 0;
  for (const g of SPIRITUAL_LIFE_GUIDES) {
    const ok = await upsertOne("SpiritualLifeGuide", g, () =>
      prisma.spiritualLifeGuide.upsert({
        where: { slug: g.slug },
        update: { status: "PUBLISHED" },
        create: { ...g, status: "PUBLISHED" },
      }),
    );
    if (ok) spiritualLifeGuides++;
  }

  try {
    await prisma.siteSetting.upsert({
      where: { key: "favicon" },
      update: {},
      create: {
        key: "favicon",
        valueJson: { url: "/favicon.svg", altText: "Via Fidei emblem" },
      },
    });
  } catch (error) {
    failures.push({
      table: "SiteSetting",
      slug: "favicon",
      error: error instanceof Error ? error.message : "unknown",
    });
  }

  return {
    prayers,
    saints,
    apparitions,
    devotions,
    parishes,
    liturgyEntries,
    spiritualLifeGuides,
    failures,
  };
}
