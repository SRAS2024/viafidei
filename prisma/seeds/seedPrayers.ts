import type { PrismaClient } from "@prisma/client";
import { PRAYERS } from "./data/prayers";

export async function seedPrayers(prisma: PrismaClient): Promise<number> {
  let count = 0;
  for (const p of PRAYERS) {
    await prisma.prayer.upsert({
      where: { slug: p.slug },
      update: {
        status: "PUBLISHED",
        officialPrayer: p.officialPrayer ?? null,
      },
      create: {
        slug: p.slug,
        defaultTitle: p.defaultTitle,
        category: p.category,
        body: p.body,
        officialPrayer: p.officialPrayer ?? null,
        status: "PUBLISHED",
      },
    });
    count++;
  }
  return count;
}
