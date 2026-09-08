import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/db/client";
import { gateAdminApiCall } from "@/lib/security/admin-gate";
import { rejectItem } from "@/lib/checklist";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const gate = await gateAdminApiCall(request);
  if (!gate.ok) return gate.response;
  const { admin } = gate;

  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { reason?: string };
  const reason = body.reason ?? "no reason supplied";
  await rejectItem(prisma, id, reason, admin.username);
  return NextResponse.json({ ok: true });
}
