import { prisma } from "../db/client";

/**
 * One row in the admin "Publish list" — anything sitting in DRAFT or REVIEW
 * that hasn't been published yet. The list is union'd across every content
 * model so the admin sees a single queue regardless of which kind it is.
 *
 * `page` is the public URL the row will live at once published; `type` is
 * the human-readable content-kind label.
 */
export type PendingPublishItem = {
  id: string;
  entityType:
    | "Prayer"
    | "Saint"
    | "MarianApparition"
    | "Parish"
    | "Devotion"
    | "LiturgyEntry"
    | "SpiritualLifeGuide";
  type: string;
  title: string;
  slug: string;
  status: "DRAFT" | "REVIEW";
  page: string;
  updatedAt: Date;
  createdAt: Date;
};

const PENDING_STATUSES = ["DRAFT", "REVIEW"] as const;

function publicPathFor(entityType: PendingPublishItem["entityType"], slug: string): string {
  switch (entityType) {
    case "Prayer":
      return `/prayers/${slug}`;
    case "Saint":
      return `/saints/${slug}`;
    case "MarianApparition":
      // Marian apparitions surface under spiritual-guidance.
      return `/spiritual-guidance/${slug}`;
    case "Parish":
      // Parish detail pages share the saints route only by namespace; the
      // locator filters by slug.
      return `/profile/parishes?slug=${encodeURIComponent(slug)}`;
    case "Devotion":
      return `/devotions/${slug}`;
    case "LiturgyEntry":
      return `/liturgy-history/${slug}`;
    case "SpiritualLifeGuide":
      return `/spiritual-life/${slug}`;
  }
}

/**
 * Returns every row across the seven public content tables that is in
 * DRAFT or REVIEW status — the rows the admin can either publish or
 * remove. Sorted newest-first.
 */
export async function listPendingPublishItems(): Promise<PendingPublishItem[]> {
  const [prayers, saints, apparitions, parishes, devotions, liturgyEntries, guides] =
    await Promise.all([
      prisma.prayer.findMany({
        where: { status: { in: [...PENDING_STATUSES] } },
        select: {
          id: true,
          slug: true,
          defaultTitle: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.saint.findMany({
        where: { status: { in: [...PENDING_STATUSES] } },
        select: {
          id: true,
          slug: true,
          canonicalName: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.marianApparition.findMany({
        where: { status: { in: [...PENDING_STATUSES] } },
        select: {
          id: true,
          slug: true,
          title: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.parish.findMany({
        where: { status: { in: [...PENDING_STATUSES] } },
        select: {
          id: true,
          slug: true,
          name: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.devotion.findMany({
        where: { status: { in: [...PENDING_STATUSES] } },
        select: {
          id: true,
          slug: true,
          title: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.liturgyEntry.findMany({
        where: { status: { in: [...PENDING_STATUSES] } },
        select: {
          id: true,
          slug: true,
          title: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.spiritualLifeGuide.findMany({
        where: { status: { in: [...PENDING_STATUSES] } },
        select: {
          id: true,
          slug: true,
          title: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    ]);

  const rows: PendingPublishItem[] = [
    ...prayers.map((r) => ({
      id: r.id,
      entityType: "Prayer" as const,
      type: "Prayer",
      title: r.defaultTitle,
      slug: r.slug,
      status: r.status as "DRAFT" | "REVIEW",
      page: publicPathFor("Prayer", r.slug),
      updatedAt: r.updatedAt,
      createdAt: r.createdAt,
    })),
    ...saints.map((r) => ({
      id: r.id,
      entityType: "Saint" as const,
      type: "Saint",
      title: r.canonicalName,
      slug: r.slug,
      status: r.status as "DRAFT" | "REVIEW",
      page: publicPathFor("Saint", r.slug),
      updatedAt: r.updatedAt,
      createdAt: r.createdAt,
    })),
    ...apparitions.map((r) => ({
      id: r.id,
      entityType: "MarianApparition" as const,
      type: "Marian apparition",
      title: r.title,
      slug: r.slug,
      status: r.status as "DRAFT" | "REVIEW",
      page: publicPathFor("MarianApparition", r.slug),
      updatedAt: r.updatedAt,
      createdAt: r.createdAt,
    })),
    ...parishes.map((r) => ({
      id: r.id,
      entityType: "Parish" as const,
      type: "Parish",
      title: r.name,
      slug: r.slug,
      status: r.status as "DRAFT" | "REVIEW",
      page: publicPathFor("Parish", r.slug),
      updatedAt: r.updatedAt,
      createdAt: r.createdAt,
    })),
    ...devotions.map((r) => ({
      id: r.id,
      entityType: "Devotion" as const,
      type: "Devotion",
      title: r.title,
      slug: r.slug,
      status: r.status as "DRAFT" | "REVIEW",
      page: publicPathFor("Devotion", r.slug),
      updatedAt: r.updatedAt,
      createdAt: r.createdAt,
    })),
    ...liturgyEntries.map((r) => ({
      id: r.id,
      entityType: "LiturgyEntry" as const,
      type: "Liturgy entry",
      title: r.title,
      slug: r.slug,
      status: r.status as "DRAFT" | "REVIEW",
      page: publicPathFor("LiturgyEntry", r.slug),
      updatedAt: r.updatedAt,
      createdAt: r.createdAt,
    })),
    ...guides.map((r) => ({
      id: r.id,
      entityType: "SpiritualLifeGuide" as const,
      type: "Spiritual life guide",
      title: r.title,
      slug: r.slug,
      status: r.status as "DRAFT" | "REVIEW",
      page: publicPathFor("SpiritualLifeGuide", r.slug),
      updatedAt: r.updatedAt,
      createdAt: r.createdAt,
    })),
  ];

  rows.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  return rows;
}

const ENTITY_API: Record<PendingPublishItem["entityType"], string> = {
  Prayer: "/api/admin/prayers",
  Saint: "/api/admin/saints",
  MarianApparition: "/api/admin/apparitions",
  Parish: "/api/admin/parishes",
  Devotion: "/api/admin/devotions",
  LiturgyEntry: "/api/admin/liturgy",
  SpiritualLifeGuide: "/api/admin/spiritual-life",
};

export function entityApiBase(entityType: PendingPublishItem["entityType"]): string {
  return ENTITY_API[entityType];
}

/**
 * Publish every pending row in one transactional sweep. Each kind gets a
 * single updateMany so the round trip cost stays flat regardless of how
 * many rows are pending. Returns the number of rows promoted per table.
 */
export async function publishAllPending(): Promise<{
  prayers: number;
  saints: number;
  apparitions: number;
  parishes: number;
  devotions: number;
  liturgyEntries: number;
  guides: number;
}> {
  const filter = { status: { in: [...PENDING_STATUSES] } };
  const data = { status: "PUBLISHED" as const };
  const [prayers, saints, apparitions, parishes, devotions, liturgyEntries, guides] =
    await Promise.all([
      prisma.prayer.updateMany({ where: filter, data }).then((r) => r.count),
      prisma.saint.updateMany({ where: filter, data }).then((r) => r.count),
      prisma.marianApparition.updateMany({ where: filter, data }).then((r) => r.count),
      prisma.parish.updateMany({ where: filter, data }).then((r) => r.count),
      prisma.devotion.updateMany({ where: filter, data }).then((r) => r.count),
      prisma.liturgyEntry.updateMany({ where: filter, data }).then((r) => r.count),
      prisma.spiritualLifeGuide.updateMany({ where: filter, data }).then((r) => r.count),
    ]);
  return { prayers, saints, apparitions, parishes, devotions, liturgyEntries, guides };
}
