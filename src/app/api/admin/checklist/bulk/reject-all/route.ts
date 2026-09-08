import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/db/client";
import { gateAdminApiCall } from "@/lib/security/admin-gate";
import { bulkReject } from "@/lib/checklist";
import type { ChecklistApprovalStatus, ChecklistContentType } from "@prisma/client";

export async function POST(request: NextRequest) {
  const gate = await gateAdminApiCall(request);
  if (!gate.ok) return gate.response;
  const { admin } = gate;

  const body = (await request.json().catch(() => ({}))) as {
    approvalStatus?: ChecklistApprovalStatus;
    contentType?: ChecklistContentType;
    reason?: string;
  };
  if (!body.reason) {
    return NextResponse.json({ error: "reason required" }, { status: 400 });
  }
  const result = await bulkReject(prisma, {
    approvalStatus: body.approvalStatus,
    contentType: body.contentType,
    reason: body.reason,
    actorUsername: admin.username,
  });
  return NextResponse.json(result);
}
