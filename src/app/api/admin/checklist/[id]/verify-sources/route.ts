import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/db/client";
import { gateAdminApiCall } from "@/lib/security/admin-gate";
import { markSourceVerified } from "@/lib/checklist";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const gate = await gateAdminApiCall(request);
  if (!gate.ok) return gate.response;
  const { admin } = gate;

  const { id } = await context.params;
  try {
    await markSourceVerified(prisma, id, admin.username);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    );
  }
}
