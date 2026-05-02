import type { CategoryScope } from "@prisma/client";
import { prisma } from "../db/client";

export function listCategories(scope?: CategoryScope) {
  return prisma.category.findMany({
    where: scope ? { scope } : undefined,
    orderBy: [{ scope: "asc" }, { sortOrder: "asc" }, { label: "asc" }],
  });
}

export function findCategoryBySlug(slug: string) {
  return prisma.category.findUnique({ where: { slug } });
}

export function upsertCategory(input: {
  slug: string;
  label: string;
  scope: CategoryScope;
  sortOrder?: number;
  description?: string | null;
}) {
  return prisma.category.upsert({
    where: { slug: input.slug },
    create: {
      slug: input.slug,
      label: input.label,
      scope: input.scope,
      sortOrder: input.sortOrder ?? 0,
      description: input.description ?? null,
    },
    update: {
      label: input.label,
      scope: input.scope,
      sortOrder: input.sortOrder ?? 0,
      description: input.description ?? null,
    },
  });
}
