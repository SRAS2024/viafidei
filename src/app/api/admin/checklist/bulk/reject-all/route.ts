import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/admin";
import { prisma } from "@/lib/db/client";
import { bulkReject } from "@/lib/checklist";
import type { ChecklistApprovalStatus, ChecklistContentType } from "@prisma/client";

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
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
