import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/db/client";
import { gateAdminApiCall } from "@/lib/security/admin-gate";
import { enqueueBuild } from "@/lib/checklist";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const gate = await gateAdminApiCall(request);
  if (!gate.ok) return gate.response;
  const { admin } = gate;

  const { id } = await context.params;
  try {
    await prisma.checklistItem.update({
      where: { id },
      data: { approvalStatus: "APPROVED_FOR_BUILD" },
    });
    const job = await enqueueBuild(prisma, {
      checklistItemId: id,
      triggeredBy: "manual",
      actorUsername: admin.username,
    });
    return NextResponse.json({ ok: true, jobId: job.id });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    );
  }
}
