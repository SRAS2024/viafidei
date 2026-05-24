import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/admin";
import { prisma } from "@/lib/db/client";
import { runFullAutonomousCycle } from "@/lib/worker";

/**
 * POST /api/admin/checklist/bulk/run-autonomous
 *
 * Runs one full autonomous custodian cycle in-process:
 *   1. Bootstrap citations from the curated knowledge base.
 *   2. Promote DISCOVERED → SOURCE_VERIFIED → APPROVED_FOR_BUILD.
 *   3. Drain the build queue, building and publishing what it can.
 *
 * This is the "Run autonomous cycle" button on the dashboard. Safe to call
 * repeatedly. Caps the build drain at 50 items per call so the request
 * stays under any platform timeout.
 */
export async function POST() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await runFullAutonomousCycle(prisma, {
    workerId: `admin-${admin.username}-${Date.now()}`,
    maxBuilds: 50,
  });
  const succeeded = result.builds.filter(
    (b) => b.status === "published" || b.status === "succeeded",
  ).length;
  return NextResponse.json({
    attempted: result.builds.length,
    succeeded,
    failed: result.builds.length - succeeded,
    errors: result.builds
      .filter((b) => b.status !== "published" && b.status !== "succeeded" && b.reason)
      .map((b) => `${b.jobId}: ${b.reason ?? b.status}`),
    bootstrapped: result.bootstrapped,
    promoted: result.promoted,
  });
}
