import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/db/client";
import { gateAdminApiCall } from "@/lib/security/admin-gate";
import { bulkVerifyAll } from "@/lib/checklist";

export async function POST(request: NextRequest) {
  const gate = await gateAdminApiCall(request);
  if (!gate.ok) return gate.response;
  const { admin } = gate;

  const result = await bulkVerifyAll(prisma, { actorUsername: admin.username });
  return NextResponse.json(result);
}
