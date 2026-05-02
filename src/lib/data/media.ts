import { prisma } from "../db/client";
import type { MediaKind, ReviewStatus } from "@prisma/client";

export function listRecentMedia(take = 60) {
  return prisma.mediaAsset.findMany({ orderBy: { createdAt: "desc" }, take });
}

export function getMediaAsset(id: string) {
  return prisma.mediaAsset.findUnique({ where: { id } });
}

export type CreateMediaInput = {
  url: string;
  altText?: string | null;
  kind?: MediaKind;
  sourceUrl?: string | null;
  sourceHost?: string | null;
  licenseInfo?: string | null;
  attribution?: string | null;
  checksum?: string | null;
  reviewStatus?: ReviewStatus;
  confidenceScore?: number | null;
};

export async function createMediaAsset(input: CreateMediaInput) {
  if (input.checksum) {
    const existing = await prisma.mediaAsset.findFirst({ where: { checksum: input.checksum } });
    if (existing) return { ok: true as const, created: false, asset: existing };
  }
  const asset = await prisma.mediaAsset.create({
    data: {
      url: input.url,
      altText: input.altText ?? null,
      kind: input.kind ?? "OTHER",
      sourceUrl: input.sourceUrl ?? null,
      sourceHost: input.sourceHost ?? null,
      licenseInfo: input.licenseInfo ?? null,
      attribution: input.attribution ?? null,
      checksum: input.checksum ?? null,
      reviewStatus: input.reviewStatus ?? "PENDING",
      confidenceScore: input.confidenceScore ?? null,
    },
  });
  return { ok: true as const, created: true, asset };
}

export async function deleteMediaAsset(id: string) {
  const existing = await prisma.mediaAsset.findUnique({ where: { id } });
  if (!existing) return { ok: false as const, reason: "not_found" as const };
  await prisma.mediaAsset.delete({ where: { id } });
  return { ok: true as const };
}
