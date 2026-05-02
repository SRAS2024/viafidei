import { prisma } from "../db/client";
import { checkRequiredTables } from "../db/tables";
import { seedAllContent } from "./seeder";

async function isDbReachable(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

async function hasSeedContent(): Promise<boolean> {
  try {
    const count = await prisma.prayer.count({ where: { status: "PUBLISHED" } });
    return count > 0;
  } catch {
    return false;
  }
}

async function triggerIngestion(): Promise<void> {
  try {
    const { ensureVaticanSchedule } = await import("../ingestion/sources");
    const { runAllActiveJobs } = await import("../ingestion/scheduler");
    await ensureVaticanSchedule();
    const result = await runAllActiveJobs({ initialStatus: "DRAFT" });
    console.log("[startup] ingestion complete", JSON.stringify({ jobs: result.totalJobs }));
  } catch (e) {
    console.error("[startup] ingestion error", e instanceof Error ? e.message : e);
  }
}

export async function runStartupTasks(): Promise<void> {
  // Brief delay so migrations (run before node server.js) finish committing
  await new Promise((r) => setTimeout(r, 2000));

  if (!(await isDbReachable())) {
    console.warn("[startup] DB unreachable — skipping seed and ingestion");
    return;
  }

  // Verify migrations ran — if tables are missing, migrations didn't complete
  const tableCheck = await checkRequiredTables().catch(() => ({ ok: false, missing: ["unknown"], present: [] }));
  if (!tableCheck.ok) {
    console.error(
      "[startup] required tables missing:",
      tableCheck.missing,
      "— ensure 'prisma migrate deploy' ran before starting the server",
    );
    return;
  }

  if (!(await hasSeedContent())) {
    console.log("[startup] empty DB detected — running initial seed");
    try {
      const summary = await seedAllContent();
      console.log("[startup] seed complete", JSON.stringify(summary));
    } catch (e) {
      console.error("[startup] seed failed", e instanceof Error ? e.message : e);
      return;
    }
  } else {
    console.log("[startup] content already present — skipping seed");
  }

  // Always trigger ingestion on every restart to pull new content incrementally
  triggerIngestion();
}
