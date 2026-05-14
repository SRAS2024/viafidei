import { prisma } from "../db/client";
import type { Prisma } from "@prisma/client";

export function listPublishedParishes(take = 40) {
  return prisma.parish.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { name: "asc" },
    take,
  });
}

export type ParishFilters = {
  q?: string;
  city?: string;
  region?: string;
  country?: string;
};

export function findPublishedParishes(filters: ParishFilters, take = 40) {
  const where: Prisma.ParishWhereInput = { status: "PUBLISHED" };
  if (filters.q) {
    // Match against every column a user might type into the search box —
    // parish name, the city/region they live in, the diocese they belong
    // to, or a fragment of the postal address (e.g. a ZIP code embedded
    // in the address string).
    where.OR = [
      { name: { contains: filters.q, mode: "insensitive" } },
      { city: { contains: filters.q, mode: "insensitive" } },
      { region: { contains: filters.q, mode: "insensitive" } },
      { diocese: { contains: filters.q, mode: "insensitive" } },
      { address: { contains: filters.q, mode: "insensitive" } },
    ];
  }
  if (filters.city) where.city = { equals: filters.city, mode: "insensitive" };
  if (filters.region) where.region = { equals: filters.region, mode: "insensitive" };
  if (filters.country) where.country = { equals: filters.country, mode: "insensitive" };
  return prisma.parish.findMany({ where, orderBy: { name: "asc" }, take });
}

export function getPublishedParishBySlug(slug: string) {
  return prisma.parish.findFirst({ where: { slug, status: "PUBLISHED" } });
}

const EARTH_KM = 6371;

export async function findParishesNear(
  latitude: number,
  longitude: number,
  radiusKm: number,
  take = 40,
) {
  const all = await prisma.parish.findMany({
    where: { status: "PUBLISHED", latitude: { not: null }, longitude: { not: null } },
    take: 500,
  });
  const withDistance = all
    .map((p) => {
      const lat = p.latitude!;
      const lon = p.longitude!;
      const dLat = ((lat - latitude) * Math.PI) / 180;
      const dLon = ((lon - longitude) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((latitude * Math.PI) / 180) *
          Math.cos((lat * Math.PI) / 180) *
          Math.sin(dLon / 2) ** 2;
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return { parish: p, distanceKm: EARTH_KM * c };
    })
    .filter((entry) => entry.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, take);
  return withDistance;
}

export function listAdminParishes(take = 200) {
  return prisma.parish.findMany({ orderBy: { name: "asc" }, take });
}

/**
 * Universal parish search. A query string runs against every field a
 * user might type into the search box: parish name, city, state /
 * region / province, country, diocese, and street address. The fields
 * are case-insensitive `contains` matches, so "Boston", "MA",
 * "Massachusetts", "United States", or "Archdiocese of Boston" all
 * surface relevant parish rows. Multi-word queries are tokenised so
 * "saint patrick boston" matches a parish whose name contains
 * "Patrick" and whose city contains "Boston" (every non-empty token
 * must hit at least one field).
 */
export function searchParishes(q: string, take = 10) {
  const trimmed = q.trim();
  if (!trimmed) return Promise.resolve([] as never[]);
  const tokens = trimmed.split(/\s+/).filter((t) => t.length > 0);
  const fields = [
    "name",
    "city",
    "region",
    "country",
    "diocese",
    "address",
  ] as const;
  // Each token must match at least one field somewhere — that's an AND
  // over tokens, each one being an OR over fields. The single-token
  // case degenerates to the original behaviour.
  const AND = tokens.map((tok) => ({
    OR: fields.map((f) => ({ [f]: { contains: tok, mode: "insensitive" } })),
  }));
  return prisma.parish.findMany({
    where: { status: "PUBLISHED", AND },
    orderBy: [{ name: "asc" }],
    take,
  });
}
