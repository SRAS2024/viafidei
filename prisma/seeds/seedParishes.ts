import type { PrismaClient } from "@prisma/client";
import { PARISHES } from "./data/parishes";

export async function seedParishes(prisma: PrismaClient) {
  for (const p of PARISHES) {
    await prisma.parish.upsert({
      where: { slug: p.slug },
      update: { status: "PUBLISHED" },
      create: { ...p, status: "PUBLISHED" },
    });
  }
}
