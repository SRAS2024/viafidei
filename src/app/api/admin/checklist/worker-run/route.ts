import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/admin";
import { prisma } from "@/lib/db/client";
import { runOneBuildCycle } from "@/lib/worker";

export async function POST() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const workerId = `admin-${admin.username}-${Date.now()}`;
  const result = await runOneBuildCycle(prisma, workerId);
  return NextResponse.json(result);
}
