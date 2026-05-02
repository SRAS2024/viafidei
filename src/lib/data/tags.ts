import type { TagKind } from "@prisma/client";
import { prisma } from "../db/client";

export type EntityType = "Prayer" | "Saint" | "MarianApparition" | "Parish" | "Devotion";

export function listTags(kind?: TagKind) {
  return prisma.tag.findMany({
    where: kind ? { kind } : undefined,
    orderBy: { label: "asc" },
  });
}

export function findTagBySlug(slug: string) {
  return prisma.tag.findUnique({ where: { slug } });
}

export function upsertTag(input: { slug: string; label: string; kind?: TagKind }) {
  return prisma.tag.upsert({
    where: { slug: input.slug },
    create: { slug: input.slug, label: input.label, kind: input.kind ?? "GENERAL" },
    update: { label: input.label, kind: input.kind ?? "GENERAL" },
  });
}

export function listTagsForEntity(entityType: EntityType, entityId: string) {
  return prisma.entityTag.findMany({
    where: { entityType, entityId },
    include: { tag: true },
    orderBy: { tag: { label: "asc" } },
  });
}

export async function setTagsForEntity(
  entityType: EntityType,
  entityId: string,
  tagIds: string[],
): Promise<void> {
  await prisma.$transaction([
    prisma.entityTag.deleteMany({ where: { entityType, entityId } }),
    prisma.entityTag.createMany({
      data: tagIds.map((tagId) => ({ entityType, entityId, tagId })),
      skipDuplicates: true,
    }),
  ]);
}

export function listEntitiesByTagSlug(entityType: EntityType, tagSlug: string) {
  return prisma.entityTag.findMany({
    where: { entityType, tag: { slug: tagSlug } },
    select: { entityId: true },
  });
}
