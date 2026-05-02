import type { PrismaClient } from "@prisma/client";
import { SAINTS } from "./data/saints";

export async function seedSaints(prisma: PrismaClient): Promise<number> {
  let count = 0;
  for (const s of SAINTS) {
    await prisma.saint.upsert({
      where: { slug: s.slug },
      update: { status: "PUBLISHED" },
      create: { ...s, status: "PUBLISHED" },
    });
    count++;
  }
  return count;
}
