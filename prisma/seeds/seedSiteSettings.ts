import type { PrismaClient } from "@prisma/client";

export async function seedSiteSettings(prisma: PrismaClient) {
  await prisma.siteSetting.upsert({
    where: { key: "favicon" },
    update: {},
    create: {
      key: "favicon",
      valueJson: { url: "/favicon.svg", altText: "Via Fidei emblem" },
    },
  });
}
