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

export type StartupSeedSummary = {
  prayers: number;
  saints: number;
  apparitions: number;
  devotions: number;
  parishes: number;
  liturgyEntries: number;
  spiritualLifeGuides: number;
};

export async function seedAllContent(): Promise<StartupSeedSummary> {
  let prayers = 0;
  for (const p of PRAYERS) {
    await prisma.prayer.upsert({
      where: { slug: p.slug },
      update: { status: "PUBLISHED", officialPrayer: p.officialPrayer ?? null },
      create: { ...p, officialPrayer: p.officialPrayer ?? null, status: "PUBLISHED" },
    });
    prayers++;
  }

  let saints = 0;
  for (const s of SAINTS) {
    await prisma.saint.upsert({
      where: { slug: s.slug },
      update: { status: "PUBLISHED" },
      create: { ...s, status: "PUBLISHED" },
    });
    saints++;
  }

  let apparitions = 0;
  for (const a of APPARITIONS) {
    await prisma.marianApparition.upsert({
      where: { slug: a.slug },
      update: { status: "PUBLISHED" },
      create: { ...a, status: "PUBLISHED" },
    });
    apparitions++;
  }

  let devotions = 0;
  for (const d of DEVOTIONS) {
    await prisma.devotion.upsert({
      where: { slug: d.slug },
      update: { status: "PUBLISHED" },
      create: { ...d, status: "PUBLISHED" },
    });
    devotions++;
  }

  let parishes = 0;
  for (const p of PARISHES) {
    await prisma.parish.upsert({
      where: { slug: p.slug },
      update: { status: "PUBLISHED" },
      create: { ...p, status: "PUBLISHED" },
    });
    parishes++;
  }

  let liturgyEntries = 0;
  for (const e of LITURGY_ENTRIES) {
    await prisma.liturgyEntry.upsert({
      where: { slug: e.slug },
      update: { status: "PUBLISHED" },
      create: { ...e, status: "PUBLISHED" },
    });
    liturgyEntries++;
  }

  let spiritualLifeGuides = 0;
  for (const g of SPIRITUAL_LIFE_GUIDES) {
    await prisma.spiritualLifeGuide.upsert({
      where: { slug: g.slug },
      update: { status: "PUBLISHED" },
      create: { ...g, status: "PUBLISHED" },
    });
    spiritualLifeGuides++;
  }

  await prisma.siteSetting.upsert({
    where: { key: "favicon" },
    update: {},
    create: {
      key: "favicon",
      valueJson: { url: "/favicon.svg", altText: "Via Fidei emblem" },
    },
  });

  return { prayers, saints, apparitions, devotions, parishes, liturgyEntries, spiritualLifeGuides };
}
