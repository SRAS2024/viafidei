import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/db/client";
import { gateAdminApiCall } from "@/lib/security/admin-gate";
import { seedChecklistFirst } from "@/lib/checklist/seed";

export async function POST(request: NextRequest) {
  const gate = await gateAdminApiCall(request);
  if (!gate.ok) return gate.response;

  const result = await seedChecklistFirst(prisma);
  return NextResponse.json({ ok: true, ...result });
}
