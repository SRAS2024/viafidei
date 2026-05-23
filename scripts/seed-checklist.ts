#!/usr/bin/env tsx
/**
 * Seed the checklist-first system: AuthoritySource registry + all 11
 * master checklists. Idempotent.
 */

import { PrismaClient } from "@prisma/client";

import { seedChecklistFirst } from "../src/lib/worker/seed";

async function main() {
  const prisma = new PrismaClient();
  try {
    const result = await seedChecklistFirst(prisma);
    console.log("Checklist seed complete:");
    console.log(result);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("[seed] fatal:", e);
  process.exitCode = 1;
});
