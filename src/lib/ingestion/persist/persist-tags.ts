import { prisma } from "../../db/client";
import { normalizeSlug } from "../slug";

type EntityType = "Prayer" | "Saint" | "MarianApparition" | "Parish" | "Devotion";

async function findEntityIdBySlug(entityType: EntityType, slug: string): Promise<string | null> {
  switch (entityType) {
    case "Prayer": {
      const e = await prisma.prayer.findUnique({ where: { slug }, select: { id: true } });
      return e?.id ?? null;
    }
    case "Saint": {
      const e = await prisma.saint.findUnique({ where: { slug }, select: { id: true } });
      return e?.id ?? null;
    }
    case "MarianApparition": {
      const e = await prisma.marianApparition.findUnique({ where: { slug }, select: { id: true } });
      return e?.id ?? null;
    }
    case "Parish": {
      const e = await prisma.parish.findUnique({ where: { slug }, select: { id: true } });
      return e?.id ?? null;
    }
    case "Devotion": {
      const e = await prisma.devotion.findUnique({ where: { slug }, select: { id: true } });
      return e?.id ?? null;
    }
  }
}

async function ensureTag(slug: string) {
  const normalized = normalizeSlug(slug);
  return prisma.tag.upsert({
    where: { slug: normalized },
    create: { slug: normalized, label: humanizeSlug(normalized) },
    update: {},
  });
}

function humanizeSlug(slug: string): string {
  return slug
    .split("-")
    .map((p) => (p.length === 0 ? p : p[0].toUpperCase() + p.slice(1)))
    .join(" ");
}

export async function applyTagsToEntity(
  entityType: EntityType,
  entitySlug: string,
  tagSlugs: string[],
): Promise<void> {
  const entityId = await findEntityIdBySlug(entityType, entitySlug);
  if (!entityId) return;

  for (const raw of tagSlugs) {
    const tag = await ensureTag(raw);
    await prisma.entityTag.upsert({
      where: {
        entityType_entityId_tagId: {
          entityType,
          entityId,
          tagId: tag.id,
        },
      },
      create: { entityType, entityId, tagId: tag.id },
      update: {},
    });
  }
}
