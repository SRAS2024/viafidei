import { prisma } from "../db/client";
import type { MilestoneTier } from "@prisma/client";

export function listMilestones(userId: string, tier?: MilestoneTier) {
  return prisma.milestone.findMany({
    where: { userId, ...(tier ? { tier } : {}) },
    orderBy: [{ tier: "asc" }, { createdAt: "desc" }],
  });
}

export type CreateMilestoneInput = {
  userId: string;
  tier: MilestoneTier;
  slug: string;
  title: string;
  description?: string | null;
};

export async function createMilestone(input: CreateMilestoneInput) {
  const existing = await prisma.milestone.findUnique({
    where: { userId_slug: { userId: input.userId, slug: input.slug } },
  });
  if (existing) return { ok: false as const, reason: "duplicate" as const };
  const milestone = await prisma.milestone.create({
    data: {
      userId: input.userId,
      tier: input.tier,
      slug: input.slug,
      title: input.title,
      description: input.description ?? null,
    },
  });
  return { ok: true as const, milestone };
}

export async function deleteMilestone(userId: string, milestoneId: string) {
  const milestone = await prisma.milestone.findUnique({ where: { id: milestoneId } });
  if (!milestone) return { ok: false as const, reason: "not_found" as const };
  if (milestone.userId !== userId) return { ok: false as const, reason: "forbidden" as const };
  await prisma.milestone.delete({ where: { id: milestoneId } });
  return { ok: true as const };
}
