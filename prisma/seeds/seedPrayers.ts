import type { PrismaClient } from "@prisma/client";
import { PRAYERS } from "./data/prayers";

export async function seedPrayers(prisma: PrismaClient) {
  for (const p of PRAYERS) {
    await prisma.prayer.upsert({
      where: { slug: p.slug },
      update: { status: "PUBLISHED" },
      create: { ...p, status: "PUBLISHED" },
    });
  }
}
