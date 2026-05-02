import type { ContentStatus } from "@prisma/client";
import { prisma } from "../db/client";
import type { ReviewableEntityType, ReviewableSummary } from "../content/types";

const REVIEW_STATUSES: ContentStatus[] = ["DRAFT", "REVIEW"];

async function listEntitiesForReview(): Promise<ReviewableSummary[]> {
  const [prayers, saints, apparitions, parishes, devotions] = await Promise.all([
    prisma.prayer.findMany({
      where: { status: { in: REVIEW_STATUSES } },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.saint.findMany({
      where: { status: { in: REVIEW_STATUSES } },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.marianApparition.findMany({
      where: { status: { in: REVIEW_STATUSES } },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.parish.findMany({
      where: { status: { in: REVIEW_STATUSES } },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.devotion.findMany({
      where: { status: { in: REVIEW_STATUSES } },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const summaries: ReviewableSummary[] = [];
  for (const e of prayers) {
    summaries.push({
      id: e.id,
      entityType: "Prayer",
      slug: e.slug,
      title: e.defaultTitle,
      status: e.status,
      updatedAt: e.updatedAt,
    });
  }
  for (const e of saints) {
    summaries.push({
      id: e.id,
      entityType: "Saint",
      slug: e.slug,
      title: e.canonicalName,
      status: e.status,
      updatedAt: e.updatedAt,
    });
  }
  for (const e of apparitions) {
    summaries.push({
      id: e.id,
      entityType: "MarianApparition",
      slug: e.slug,
      title: e.title,
      status: e.status,
      updatedAt: e.updatedAt,
    });
  }
  for (const e of parishes) {
    summaries.push({
      id: e.id,
      entityType: "Parish",
      slug: e.slug,
      title: e.name,
      status: e.status,
      updatedAt: e.updatedAt,
    });
  }
  for (const e of devotions) {
    summaries.push({
      id: e.id,
      entityType: "Devotion",
      slug: e.slug,
      title: e.title,
      status: e.status,
      updatedAt: e.updatedAt,
    });
  }
  summaries.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  return summaries;
}

export async function getReviewQueue(take = 100): Promise<ReviewableSummary[]> {
  const all = await listEntitiesForReview();
  return all.slice(0, take);
}

export type ReviewQueueCounts = {
  Prayer: number;
  Saint: number;
  MarianApparition: number;
  Parish: number;
  Devotion: number;
  total: number;
};

export async function getReviewQueueCounts(): Promise<ReviewQueueCounts> {
  const [prayer, saint, apparition, parish, devotion] = await Promise.all([
    prisma.prayer.count({ where: { status: { in: REVIEW_STATUSES } } }),
    prisma.saint.count({ where: { status: { in: REVIEW_STATUSES } } }),
    prisma.marianApparition.count({ where: { status: { in: REVIEW_STATUSES } } }),
    prisma.parish.count({ where: { status: { in: REVIEW_STATUSES } } }),
    prisma.devotion.count({ where: { status: { in: REVIEW_STATUSES } } }),
  ]);
  return {
    Prayer: prayer,
    Saint: saint,
    MarianApparition: apparition,
    Parish: parish,
    Devotion: devotion,
    total: prayer + saint + apparition + parish + devotion,
  };
}

export type EntityType = ReviewableEntityType;
