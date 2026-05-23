import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/admin";
import { prisma } from "@/lib/db/client";
import { enqueueBuild, unpublish } from "@/lib/worker";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    op?: "accept" | "dismiss";
    action?: "edit" | "delete";
  };
  if (body.op === "dismiss") {
    // A janitor finding is computed live every time the page renders;
    // dismiss is a no-op here. To make a finding go away the operator must
    // fix the underlying cause (rebuild / unpublish / etc.).
    return NextResponse.json({ ok: true, dismissed: true });
  }
  if (body.op !== "accept") {
    return NextResponse.json({ error: "op required" }, { status: 400 });
  }
  if (body.action === "delete") {
    const result = await unpublish(prisma, id, admin.username, "Janitor recommendation accepted.");
    return NextResponse.json(result);
  }
  // edit → enqueue a rebuild
  await prisma.checklistItem.update({
    where: { id },
    data: { approvalStatus: "APPROVED_FOR_BUILD" },
  });
  const job = await enqueueBuild(prisma, {
    checklistItemId: id,
    triggeredBy: "janitor",
    actorUsername: admin.username,
  });
  return NextResponse.json({ ok: true, jobId: job.id });
}
