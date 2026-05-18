// Imports only pure data arrays — no Prisma dependency in the imported files.
// This file is compiled into the Next.js server bundle at build time.
import { PRAYERS } from "../../../prisma/seeds/data/prayers";
import { SAINTS } from "../../../prisma/seeds/data/saints";
import { APPARITIONS } from "../../../prisma/seeds/data/apparitions";
import { DEVOTIONS } from "../../../prisma/seeds/data/devotions";
import { PARISHES } from "../../../prisma/seeds/data/parishes";
import { LITURGY_ENTRIES } from "../../../prisma/seeds/data/liturgyEntries";
import { ENCYCLICAL_ENTRIES } from "../../../prisma/seeds/data/encyclicals";
import { CHURCH_DOCUMENT_ENTRIES } from "../../../prisma/seeds/data/churchDocuments";
import { RITE_HISTORY_ENTRIES } from "../../../prisma/seeds/data/riteHistory";
import { SPIRITUAL_LIFE_GUIDES } from "../../../prisma/seeds/data/spiritualLifeGuides";
import { SACRAMENT_GUIDES } from "../../../prisma/seeds/data/sacraments";
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
 *
 * Public-gate handover: every seeded row is created at status=DRAFT and
 * without publicRenderReady/isThresholdEligible. The strict-cleanup
 * pass (which runs on a 5-minute bucket via the cron route + worker)
 * walks every catalog row, runs strict QA against the package
 * contract, and either flips the public-gate flags to true (when the
 * row passes) or hard-deletes + logs (when it fails). This preserves
 * the spec invariant: "Do not allow any feature to create public
 * content outside the content factory."
 *
 * The update branch never touches `status` — if a row is already at
 * DRAFT (because strict cleanup demoted it), the seeder must not
 * forcibly flip it back to PUBLISHED.
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
        update: { officialPrayer: p.officialPrayer ?? null },
        create: { ...p, officialPrayer: p.officialPrayer ?? null, status: "DRAFT" },
      }),
    );
    if (ok) prayers++;
  }

  let saints = 0;
  for (const s of SAINTS) {
    const ok = await upsertOne("Saint", s, () =>
      prisma.saint.upsert({
        where: { slug: s.slug },
        update: {},
        create: { ...s, status: "DRAFT" },
      }),
    );
    if (ok) saints++;
  }

  let apparitions = 0;
  for (const a of APPARITIONS) {
    const ok = await upsertOne("MarianApparition", a, () =>
      prisma.marianApparition.upsert({
        where: { slug: a.slug },
        update: {},
        create: { ...a, status: "DRAFT" },
      }),
    );
    if (ok) apparitions++;
  }

  let devotions = 0;
  for (const d of DEVOTIONS) {
    const ok = await upsertOne("Devotion", d, () =>
      prisma.devotion.upsert({
        where: { slug: d.slug },
        update: {},
        create: { ...d, status: "DRAFT" },
      }),
    );
    if (ok) devotions++;
  }

  let parishes = 0;
  for (const p of PARISHES) {
    const ok = await upsertOne("Parish", p, () =>
      prisma.parish.upsert({
        where: { slug: p.slug },
        update: {},
        create: { ...p, status: "DRAFT" },
      }),
    );
    if (ok) parishes++;
  }

  let liturgyEntries = 0;
  // Concatenate base liturgy entries + encyclical seeds + church-document
  // seeds (CCC sections + Code of Canon Law books) + rite-inception
  // entries (one per Catholic rite, surfacing on the timeline). Every
  // row uses the same LiturgyEntry schema, so the same upsert path
  // handles them all.
  for (const e of [
    ...LITURGY_ENTRIES,
    ...ENCYCLICAL_ENTRIES,
    ...CHURCH_DOCUMENT_ENTRIES,
    ...RITE_HISTORY_ENTRIES,
  ]) {
    const ok = await upsertOne("LiturgyEntry", e, () =>
      prisma.liturgyEntry.upsert({
        where: { slug: e.slug },
        update: {},
        create: { ...e, status: "DRAFT" },
      }),
    );
    if (ok) liturgyEntries++;
  }

  let spiritualLifeGuides = 0;
  // Concatenate base guides + the 7 sacraments + 4 personal consecrations.
  for (const g of [...SPIRITUAL_LIFE_GUIDES, ...SACRAMENT_GUIDES]) {
    const ok = await upsertOne("SpiritualLifeGuide", g, () =>
      prisma.spiritualLifeGuide.upsert({
        where: { slug: g.slug },
        update: {},
        create: { ...g, status: "DRAFT" },
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
