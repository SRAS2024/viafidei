import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/admin";
import { prisma } from "@/lib/db/client";
import { publish, runQA, type BuiltContentPackage } from "@/lib/worker";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await context.params;
  try {
    const lastJob = await prisma.workerBuildJob.findFirst({
      where: { checklistItemId: id, status: { in: ["succeeded", "partial"] } },
      orderBy: { attempt: "desc" },
    });
    const item = await prisma.checklistItem.findUnique({ where: { id } });
    if (!lastJob || !lastJob.resultPayload || !item) {
      return NextResponse.json(
        { error: "No completed build payload to publish. Run the worker first." },
        { status: 409 },
      );
    }
    const pkg: BuiltContentPackage = {
      contentType: item.contentType,
      canonicalSlug: item.canonicalSlug,
      title: item.canonicalName,
      fields: {},
      payload: lastJob.resultPayload as Record<string, unknown>,
      authorityLevel: item.authorityLevelHint ?? "TRUSTED_PUBLISHER",
      confidence: lastJob.confidence ?? 0.5,
      warnings: [],
      citations: [],
      needsHumanReview: false,
    };
    const qa = runQA(pkg);
    const result = await publish(prisma, {
      checklistItemId: id,
      pkg,
      qa,
      buildJobId: lastJob.id,
      actorUsername: admin.username,
      forceReviewBypass: true,
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    );
  }
}
