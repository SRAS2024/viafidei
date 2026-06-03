import type { MetadataRoute } from "next";

import { publicRouteFor } from "@/lib/admin-worker/public-routes";
import { appConfig } from "@/lib/config";
import { prisma } from "@/lib/db/client";

const BASE = appConfig.canonicalUrl;

const PUBLIC_STATIC_PATHS: ReadonlyArray<{
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority: number;
}> = [
  { path: "", changeFrequency: "weekly", priority: 1 },
  { path: "/prayers", changeFrequency: "weekly", priority: 0.8 },
  { path: "/devotions", changeFrequency: "weekly", priority: 0.8 },
  { path: "/novenas", changeFrequency: "weekly", priority: 0.7 },
  { path: "/saints", changeFrequency: "weekly", priority: 0.8 },
  { path: "/sacraments", changeFrequency: "weekly", priority: 0.8 },
  { path: "/guides", changeFrequency: "weekly", priority: 0.8 },
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
      // publicRouteFor is the single source of truth for each type's detail
      // URL, so the sitemap and the worker's post-publish probe never drift.
      url: `${BASE}${publicRouteFor(row.contentType, row.slug).slugPath}`,
      lastModified: row.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }));
  } catch {
    // sitemap must never crash a deploy
  }

  return [...staticEntries, ...dynamicEntries];
}
