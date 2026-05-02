import type { PrismaClient } from "@prisma/client";
import { APPARITIONS } from "./data/apparitions";

export async function seedApparitions(prisma: PrismaClient): Promise<number> {
  let count = 0;
  for (const a of APPARITIONS) {
    await prisma.marianApparition.upsert({
      where: { slug: a.slug },
      update: { status: "PUBLISHED" },
      create: { ...a, status: "PUBLISHED" },
    });
    count++;
  }
  return count;
}
