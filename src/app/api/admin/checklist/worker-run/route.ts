import { requireAdmin } from "@/lib/auth/admin";
import { legacyDisabledResponse } from "@/lib/worker/legacy-disabled";
import { NextResponse } from "next/server";

/**
 * Spec §1: hard-disabled. The legacy runOneBuildCycle build/publish
 * engine is no longer an active content path — the Admin Worker
 * artifact pipeline is the only system that builds + publishes.
 */
export async function POST() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return legacyDisabledResponse();
}
