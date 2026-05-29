import { requireAdmin } from "@/lib/auth/admin";
import { legacyDisabledResponse } from "@/lib/worker/legacy-disabled";
import { NextResponse } from "next/server";

/**
 * Spec §1: hard-disabled. The legacy "run full autonomous cycle"
 * (runFullAutonomousCycle) build/publish engine is no longer an active
 * content path. The Admin Worker (brain → dispatcher → artifact
 * pipeline → runPublishOrchestrator) is the only autonomous system.
 * Use the Admin Worker command center at /admin/admin-worker.
 */
export async function POST() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return legacyDisabledResponse();
}
