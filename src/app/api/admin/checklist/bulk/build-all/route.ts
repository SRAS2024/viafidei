import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/admin";
import { prisma } from "@/lib/db/client";
import { bulkBuildAll } from "@/lib/worker";

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as { includeReview?: boolean };
  const result = await bulkBuildAll(prisma, {
    actorUsername: admin.username,
    includeReview: body.includeReview === true,
  });
  return NextResponse.json(result);
}
