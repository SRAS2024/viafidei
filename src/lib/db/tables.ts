import { prisma } from "./client";

const REQUIRED_TABLES = [
  "User",
  "Session",
  "Profile",
  "Prayer",
  "Saint",
  "MarianApparition",
  "Parish",
  "Devotion",
  "LiturgyEntry",
  "SpiritualLifeGuide",
  "DailyLiturgy",
  "JournalEntry",
  "Goal",
  "Milestone",
  "RateLimitBucket",
] as const;

export type TableCheckResult = {
  ok: boolean;
  missing: string[];
  present: string[];
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
  return { ok: missing.length === 0, missing, present };
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
