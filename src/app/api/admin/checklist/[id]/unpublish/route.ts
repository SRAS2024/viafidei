import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/db/client";
import { gateAdminApiCall } from "@/lib/security/admin-gate";
import { unpublish } from "@/lib/checklist";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const gate = await gateAdminApiCall(request);
  if (!gate.ok) return gate.response;
  const { admin } = gate;

  const { id } = await context.params;
  let reason: string | undefined;
  try {
    const body = await request.json();
    if (body && typeof body.reason === "string") reason = body.reason;
  } catch {}
  const result = await unpublish(prisma, id, admin.username, reason);
  return NextResponse.json(result);
}
