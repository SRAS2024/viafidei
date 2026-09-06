/**
 * Prayer of the day — a deterministic daily rotation over the published prayer
 * library, computed at request time from the calendar date alone. It runs on
 * the web service with no worker involved, so the homepage keeps cycling
 * through the library every day whether or not the Admin Worker is on, and
 * every visitor sees the same prayer on the same date.
 *
 * Seasonally aware without ever being wrong: during Lent the rotation prefers
 * penitential prayers, during Advent and Christmas Marian ones, in Easter
 * Eucharistic and Trinitarian ones — falling back to the whole library when a
 * season has no prayers of that kind. The pick is `hash(date) mod count` over
 * an indexed, stable ordering (slug), so it costs one count + one offset read.
 */

import { prisma } from "@/lib/db/client";
import { liturgicalSeasonFor } from "@/lib/content-shared/liturgical-calendar";
import { categorizePrayer } from "@/lib/content-shared/prayer-categories";

export interface PrayerOfTheDay {
  slug: string;
  title: string;
  subtitle: string | null;
  category: string;
  /** First lines of the prayer text, for the homepage card. */
  excerpt: string;
}

/** Stable 32-bit FNV-1a hash of a string (pure). */
export function hashDate(iso: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < iso.length; i++) {
    h ^= iso.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Preferred canonical categories for a season, in order. Pure. */
export function seasonalPreference(iso: string): string[] {
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return [];
  switch (liturgicalSeasonFor(date)) {
    case "lent":
    case "triduum":
      return ["penitential"];
    case "advent":
    case "christmas":
      return ["marian"];
    case "easter":
      return ["eucharistic", "trinitarian"];
    default:
      return [];
  }
}

function excerptOf(payload: Record<string, unknown>): string {
  const text =
    (typeof payload.body === "string" && payload.body) ||
    (typeof payload.prayerText === "string" && payload.prayerText) ||
    "";
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > 220 ? `${flat.slice(0, 217).trimEnd()}…` : flat;
}

/**
 * Pick the day's prayer. `iso` is the visitor's local date (YYYY-MM-DD).
 * Returns null only when no prayer is published at all.
 */
export async function prayerOfTheDay(iso: string): Promise<PrayerOfTheDay | null> {
  const where = { contentType: "PRAYER" as const, isPublished: true };
  const total = await prisma.publishedContent.count({ where });
  if (total === 0) return null;

  const seed = hashDate(iso);
  const preferred = new Set(seasonalPreference(iso));

  // Seasonal preference: look at a small window of candidates around the
  // day's slot and take the first that matches the season's category. The
  // window is fetched in one query; when nothing in it matches, the slot's own
  // prayer is used — so the season never empties the rotation.
  const slot = seed % total;
  const windowSize = preferred.size > 0 ? Math.min(total, 12) : 1;
  const rows = await prisma.publishedContent.findMany({
    where,
    orderBy: { slug: "asc" },
    skip: slot,
    take: windowSize,
    select: { slug: true, title: true, subtitle: true, payload: true },
  });
  // Wrap around the end of the ordering so the window is always full.
  if (rows.length < windowSize && slot + rows.length >= total) {
    const wrap = await prisma.publishedContent.findMany({
      where,
      orderBy: { slug: "asc" },
      take: windowSize - rows.length,
      select: { slug: true, title: true, subtitle: true, payload: true },
    });
    rows.push(...wrap);
  }
  if (rows.length === 0) return null;

  const described = rows.map((r) => {
    const payload = (r.payload ?? {}) as Record<string, unknown>;
    const category = categorizePrayer({
      title: r.title,
      prayerType: typeof payload.prayerType === "string" ? payload.prayerType : undefined,
      body: typeof payload.body === "string" ? payload.body : undefined,
      category: typeof payload.category === "string" ? payload.category : undefined,
    });
    return { r, payload, category };
  });
  const pick = described.find((d) => preferred.has(d.category)) ?? described[0]!;
  return {
    slug: pick.r.slug,
    title: pick.r.title,
    subtitle: pick.r.subtitle ?? null,
    category: pick.category,
    excerpt: excerptOf(pick.payload),
  };
}
