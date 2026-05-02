import { prisma } from "../db/client";

export function listRecentMedia(take = 60) {
  return prisma.mediaAsset.findMany({ orderBy: { createdAt: "desc" }, take });
}
