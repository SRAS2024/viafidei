import { prisma } from "./client";

/**
 * Tables that the public site reads from for guides, prayers, saints,
 * devotions, apparitions, liturgy entries, and parishes. The health check
 * surfaces this list separately so a deploy that's missing a content table
 * is reported as `migration_required` instead of crashing the first request.
 */
export const PUBLIC_CONTENT_TABLES = [
  "Prayer",
  "Saint",
  "MarianApparition",
  "Parish",
  "Devotion",
  "LiturgyEntry",
  "SpiritualLifeGuide",
  "DailyLiturgy",
] as const;

const REQUIRED_TABLES = [
  "User",
  "Session",
  "Profile",
  ...PUBLIC_CONTENT_TABLES,
  "JournalEntry",
  "Goal",
  "Milestone",
  "RateLimitBucket",
  "IngestionSource",
  "IngestionJob",
  "IngestionJobRun",
] as const;

export type TableCheckResult = {
  ok: boolean;
  missing: string[];
  present: string[];
  publicContentMissing: string[];
};

export async function checkRequiredTables(): Promise<TableCheckResult> {
  const rows = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
  `;
  const existing = new Set(rows.map((r) => r.tablename));
  const present: string[] = [];
  const missing: string[] = [];
  for (const table of REQUIRED_TABLES) {
    if (existing.has(table)) {
      present.push(table);
    } else {
      missing.push(table);
    }
  }
  const publicContentMissing = PUBLIC_CONTENT_TABLES.filter((t) => !existing.has(t));
  return { ok: missing.length === 0, missing, present, publicContentMissing };
}

export async function checkSeedContent(): Promise<{ ok: boolean; counts: Record<string, number> }> {
  const [prayers, saints, apparitions, devotions, liturgy, guides] = await Promise.all([
    prisma.prayer.count({ where: { status: "PUBLISHED" } }),
    prisma.saint.count({ where: { status: "PUBLISHED" } }),
    prisma.marianApparition.count({ where: { status: "PUBLISHED" } }),
    prisma.devotion.count({ where: { status: "PUBLISHED" } }),
    prisma.liturgyEntry.count({ where: { status: "PUBLISHED" } }),
    prisma.spiritualLifeGuide.count({ where: { status: "PUBLISHED" } }),
  ]);
  const counts = { prayers, saints, apparitions, devotions, liturgy, guides };
  const ok = Object.values(counts).some((c) => c > 0);
  return { ok, counts };
}
