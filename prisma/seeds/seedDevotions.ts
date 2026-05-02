import type { PrismaClient } from "@prisma/client";
import { DEVOTIONS } from "./data/devotions";

export async function seedDevotions(prisma: PrismaClient): Promise<number> {
  let count = 0;
  for (const d of DEVOTIONS) {
    await prisma.devotion.upsert({
      where: { slug: d.slug },
      update: { status: "PUBLISHED" },
      create: { ...d, status: "PUBLISHED" },
    });
    count++;
  }
  return count;
}
