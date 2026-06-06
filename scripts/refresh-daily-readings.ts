#!/usr/bin/env tsx
/**
 * Manually refresh the daily liturgical readings (the worker also does this
 * on a throttled schedule during its loop). Prints the result.
 *
 * Usage:
 *   tsx scripts/refresh-daily-readings.ts            # today
 *   tsx scripts/refresh-daily-readings.ts 2026-06-07 # a specific date
 */

import { refreshDailyReadings } from "../src/lib/admin-worker/daily-readings";
import { prisma } from "../src/lib/db/client";

async function main() {
  const arg = process.argv[2];
  const date = arg ? new Date(`${arg}T00:00:00Z`) : undefined;
  if (arg && Number.isNaN(date?.getTime())) {
    console.error(`Invalid date: ${arg} (expected YYYY-MM-DD)`);
    process.exitCode = 1;
    return;
  }
  try {
    const result = await refreshDailyReadings(prisma, { date });
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("[refresh-daily-readings] fatal:", err);
  process.exitCode = 1;
});
