import type { PrismaClient } from "@prisma/client";
import { APPARITIONS } from "./data/apparitions";

export async function seedApparitions(prisma: PrismaClient) {
  for (const a of APPARITIONS) {
    await prisma.marianApparition.upsert({
      where: { slug: a.slug },
      update: { status: "PUBLISHED" },
      create: { ...a, status: "PUBLISHED" },
    });
  }
}
