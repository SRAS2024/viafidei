import type { MetadataRoute } from "next";

import { appConfig } from "@/lib/config";
import { prisma } from "@/lib/db/client";
import type { ChecklistContentType } from "@prisma/client";

const BASE = appConfig.canonicalUrl;

const PUBLIC_STATIC_PATHS: ReadonlyArray<{
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority: number;
}> = [
  { path: "", changeFrequency: "weekly", priority: 1 },
  { path: "/prayers", changeFrequency: "weekly", priority: 0.8 },
  { path: "/devotions", changeFrequency: "weekly", priority: 0.8 },
  { path: "/saints", changeFrequency: "weekly", priority: 0.8 },
  { path: "/sacraments", changeFrequency: "weekly", priority: 0.8 },
  { path: "/spiritual-life", changeFrequency: "weekly", priority: 0.8 },
  { path: "/our-lady", changeFrequency: "weekly", priority: 0.7 },
  { path: "/parishes", changeFrequency: "weekly", priority: 0.7 },
  { path: "/popes", changeFrequency: "weekly", priority: 0.7 },
  { path: "/doctors", changeFrequency: "weekly", priority: 0.7 },
  { path: "/rites", changeFrequency: "weekly", priority: 0.7 },
  { path: "/liturgy", changeFrequency: "weekly", priority: 0.7 },
  { path: "/liturgical-calendar", changeFrequency: "daily", priority: 0.7 },
  { path: "/liturgy-history", changeFrequency: "weekly", priority: 0.7 },
  { path: "/history", changeFrequency: "weekly", priority: 0.7 },
  { path: "/church-documents", changeFrequency: "weekly", priority: 0.7 },
  { path: "/search", changeFrequency: "weekly", priority: 0.5 },
  { path: "/privacy", changeFrequency: "yearly", priority: 0.4 },
];

const CONTENT_TYPE_PATHS: Record<ChecklistContentType, string> = {
  PRAYER: "/prayers",
  DEVOTION: "/devotions",
  SAINT: "/saints",
  MARIAN_TITLE: "/our-lady",
  APPARITION: "/our-lady",
  NOVENA: "/devotions",
  SACRAMENT: "/sacraments",
  GUIDE: "/spiritual-life",
  CHURCH_DOCUMENT: "/liturgy-history",
  LITURGICAL: "/liturgy-history",
  SPIRITUAL_PRACTICE: "/spiritual-life",
  PARISH: "/parishes",
  POPE: "/popes",
  DOCTOR: "/doctors",
  RITE: "/rites",
};

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

  let dynamicEntries: MetadataRoute.Sitemap = [];
  try {
    const published = await prisma.publishedContent.findMany({
      where: { isPublished: true },
      select: { contentType: true, slug: true, updatedAt: true },
    });
    dynamicEntries = published.map((row) => ({
      url: `${BASE}${CONTENT_TYPE_PATHS[row.contentType]}/${row.slug}`,
      lastModified: row.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }));
  } catch {
    // sitemap must never crash a deploy
  }

  return [...staticEntries, ...dynamicEntries];
}
