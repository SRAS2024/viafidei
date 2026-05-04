import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db/client";

const BASE = process.env.CANONICAL_URL || "https://etviafidei.com";

// Static, public, indexable surface. Private/auth/admin pages
// (/login, /register, /forgot-password, /reset-password, /verify-email,
// /profile, /admin) are intentionally excluded — they're either gated or
// shouldn't be indexed.
const PUBLIC_STATIC_PATHS: ReadonlyArray<{
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority: number;
}> = [
  { path: "", changeFrequency: "weekly", priority: 1 },
  { path: "/prayers", changeFrequency: "weekly", priority: 0.8 },
  { path: "/devotions", changeFrequency: "weekly", priority: 0.8 },
  { path: "/saints", changeFrequency: "weekly", priority: 0.8 },
  { path: "/spiritual-life", changeFrequency: "weekly", priority: 0.8 },
  { path: "/spiritual-guidance", changeFrequency: "weekly", priority: 0.7 },
  { path: "/liturgy-history", changeFrequency: "weekly", priority: 0.7 },
  { path: "/search", changeFrequency: "weekly", priority: 0.5 },
  { path: "/privacy", changeFrequency: "yearly", priority: 0.4 },
];

type DynamicGroup = {
  prefix: string;
  rows: Array<{ slug: string; updatedAt: Date }>;
};

async function loadPublishedContent(): Promise<DynamicGroup[]> {
  // Each query returns only PUBLISHED records — drafts, review, and archived
  // content must never appear in the public sitemap.
  try {
    const [prayers, saints, apparitions, devotions, liturgy, parishes, guides] = await Promise.all([
      prisma.prayer.findMany({
        where: { status: "PUBLISHED" },
        select: { slug: true, updatedAt: true },
      }),
      prisma.saint.findMany({
        where: { status: "PUBLISHED" },
        select: { slug: true, updatedAt: true },
      }),
      prisma.marianApparition.findMany({
        where: { status: "PUBLISHED" },
        select: { slug: true, updatedAt: true },
      }),
      prisma.devotion.findMany({
        where: { status: "PUBLISHED" },
        select: { slug: true, updatedAt: true },
      }),
      prisma.liturgyEntry.findMany({
        where: { status: "PUBLISHED" },
        select: { slug: true, updatedAt: true },
      }),
      prisma.parish.findMany({
        where: { status: "PUBLISHED" },
        select: { slug: true, updatedAt: true },
      }),
      prisma.spiritualLifeGuide.findMany({
        where: { status: "PUBLISHED" },
        select: { slug: true, updatedAt: true },
      }),
    ]);
    return [
      { prefix: "/prayers", rows: prayers },
      { prefix: "/saints", rows: saints },
      // Marian apparitions render under /spiritual-guidance/[slug] on the public site.
      { prefix: "/spiritual-guidance", rows: apparitions },
      { prefix: "/devotions", rows: devotions },
      { prefix: "/liturgy-history", rows: liturgy },
      { prefix: "/parishes", rows: parishes },
      { prefix: "/spiritual-life", rows: guides },
    ];
  } catch {
    // The sitemap endpoint must never crash a deploy; if the DB is offline
    // (or this is invoked during build with no DB), fall back to static only.
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticEntries: MetadataRoute.Sitemap = PUBLIC_STATIC_PATHS.map(
    ({ path, changeFrequency, priority }) => ({
      url: `${BASE}${path}`,
      lastModified: now,
      changeFrequency,
      priority,
    }),
  );

  const groups = await loadPublishedContent();
  const dynamicEntries: MetadataRoute.Sitemap = groups.flatMap((g) =>
    g.rows.map((row) => ({
      url: `${BASE}${g.prefix}/${row.slug}`,
      lastModified: row.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  );

  return [...staticEntries, ...dynamicEntries];
}
