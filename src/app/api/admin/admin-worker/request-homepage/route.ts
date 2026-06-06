import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/admin";
import { createTask, redesignHomepage } from "@/lib/admin-worker";
import { prisma } from "@/lib/db/client";
import { writeAudit } from "@/lib/audit";

export const runtime = "nodejs";

/**
 * POST /api/admin/admin-worker/request-homepage
 *
 * Operator-triggered "Request Homepage Makeover" (spec §22). Creates
 * an AdminWorkerTask of type UPDATE_HOMEPAGE and runs the homepage
 * mutator inline so the operator gets immediate feedback (draft id +
 * status). The mutator's existing safety policy still applies — major
 * redesigns and section deletions route to review.
 */
export async function POST() {
  const admin = await requireAdmin();
  if (!admin) return new NextResponse("Forbidden", { status: 403 });

  const task = await createTask(prisma, {
    taskType: "UPDATE_HOMEPAGE",
    priority: "HOMEPAGE",
    plannedAction: `Homepage makeover requested by ${admin.username}`,
    metadata: { requestedBy: admin.username, requestedAt: new Date().toISOString() },
  });

  await writeAudit({
    action: "admin_worker.request_homepage_makeover",
    entityType: "AdminWorkerTask",
    entityId: task.id,
    actorUsername: admin.username,
  });

  // Admin explicitly asked for a makeover — always produce a reviewable
  // draft so the operator gets a preview / publish / discard choice,
  // even when the homepage already scores above the redesign threshold.
  const result = await redesignHomepage(prisma, { mode: "ADMIN_REQUESTED", force: true });

  return NextResponse.json({
    taskId: task.id,
    draftId: result.draftId,
    status: result.status,
    finalScore: result.finalScore,
    sectionsChanged: result.sectionsChanged,
    reasonSummary: result.reasonSummary,
  });
}
