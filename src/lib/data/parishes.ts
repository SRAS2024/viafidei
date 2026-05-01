import { prisma } from "../db/client";

export function listPublishedParishes(take = 40) {
  return prisma.parish.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { name: "asc" },
    take,
  });
}

export function listAdminParishes(take = 200) {
  return prisma.parish.findMany({ orderBy: { name: "asc" }, take });
}

export function searchParishes(q: string, take = 10) {
  return prisma.parish.findMany({
    where: {
      status: "PUBLISHED",
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { city: { contains: q, mode: "insensitive" } },
      ],
    },
    take,
  });
}
