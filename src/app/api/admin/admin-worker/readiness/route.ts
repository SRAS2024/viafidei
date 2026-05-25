import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/admin";
import { runReadiness } from "@/lib/admin-worker";
import { prisma } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/admin-worker/readiness
 *
 * Production-readiness report (spec §28). Returns the full check
 * list, the composite score (0..1), and concrete repair instructions
 * for every failing check.
 */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return new NextResponse("Forbidden", { status: 403 });
  const report = await runReadiness(prisma);
  return NextResponse.json(report);
}
