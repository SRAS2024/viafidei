import type { PrismaClient } from "@prisma/client";
import { LITURGY_ENTRIES } from "./data/liturgyEntries";

export async function seedLiturgyEntries(prisma: PrismaClient) {
  for (const e of LITURGY_ENTRIES) {
    await prisma.liturgyEntry.upsert({
      where: { slug: e.slug },
      update: { status: "PUBLISHED" },
      create: { ...e, status: "PUBLISHED" },
    });
  }
}
