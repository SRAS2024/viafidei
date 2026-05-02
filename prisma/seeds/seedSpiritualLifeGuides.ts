import type { PrismaClient } from "@prisma/client";
import { SPIRITUAL_LIFE_GUIDES } from "./data/spiritualLifeGuides";

export async function seedSpiritualLifeGuides(prisma: PrismaClient) {
  for (const g of SPIRITUAL_LIFE_GUIDES) {
    await prisma.spiritualLifeGuide.upsert({
      where: { slug: g.slug },
      update: { status: "PUBLISHED" },
      create: { ...g, status: "PUBLISHED" },
    });
  }
}
