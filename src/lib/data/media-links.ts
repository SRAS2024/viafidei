import { prisma } from "../db/client";

export type EntityType = "Prayer" | "Saint" | "MarianApparition" | "Parish" | "Devotion";

export function listMediaForEntity(entityType: EntityType, entityId: string) {
  return prisma.entityMediaLink.findMany({
    where: { entityType, entityId },
    include: { mediaAsset: true },
    orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
  });
}

export async function findPrimaryMediaForEntity(entityType: EntityType, entityId: string) {
  return prisma.entityMediaLink.findFirst({
    where: { entityType, entityId, isPrimary: true },
    include: { mediaAsset: true },
  });
}

export async function linkMediaToEntity(args: {
  entityType: EntityType;
  entityId: string;
  mediaAssetId: string;
  isPrimary?: boolean;
  sortOrder?: number;
}) {
  if (args.isPrimary) {
    await prisma.entityMediaLink.updateMany({
      where: { entityType: args.entityType, entityId: args.entityId, isPrimary: true },
      data: { isPrimary: false },
    });
  }
  return prisma.entityMediaLink.upsert({
    where: {
      entityType_entityId_mediaAssetId: {
        entityType: args.entityType,
        entityId: args.entityId,
        mediaAssetId: args.mediaAssetId,
      },
    },
    create: {
      entityType: args.entityType,
      entityId: args.entityId,
      mediaAssetId: args.mediaAssetId,
      isPrimary: args.isPrimary ?? false,
      sortOrder: args.sortOrder ?? 0,
    },
    update: {
      isPrimary: args.isPrimary ?? false,
      sortOrder: args.sortOrder ?? 0,
    },
  });
}

export function unlinkMediaFromEntity(args: {
  entityType: EntityType;
  entityId: string;
  mediaAssetId: string;
}) {
  return prisma.entityMediaLink.deleteMany({
    where: {
      entityType: args.entityType,
      entityId: args.entityId,
      mediaAssetId: args.mediaAssetId,
    },
  });
}
