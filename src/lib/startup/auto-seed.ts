/**
 * Startup tasks for the checklist-first system.
 *
 * On boot, the app verifies required database tables exist and then
 * seeds the AuthoritySource registry + master checklists (idempotent).
 * Nothing else runs at startup — the worker is a separate process.
 */

import { prisma } from "../db/client";
import { checkRequiredTables } from "../db/tables";
import { logger } from "../observability/logger";
import { ensureAccountEmailTables } from "./ensure-email-tables";
import { seedChecklistFirst } from "../worker/seed";

let scheduled = false;

async function isDbReachable(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

export async function runStartupTasks(): Promise<void> {
  if (scheduled) return;
  scheduled = true;
  if (!(await isDbReachable())) {
    logger.warn("startup.db_unreachable", { skipping: "all-startup-tasks" });
    return;
  }
  try {
    await checkRequiredTables();
  } catch (err) {
    logger.error("startup.required_tables_check_failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return;
  }
  await ensureAccountEmailTables().catch((err) => {
    logger.warn("startup.account_email_tables_failed", {
      error: err instanceof Error ? err.message : String(err),
    });
  });
  try {
    const result = await seedChecklistFirst(prisma);
    logger.info("startup.checklist_seeded", { ...result });
  } catch (err) {
    logger.warn("startup.checklist_seed_failed", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
