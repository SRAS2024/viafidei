import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/admin";
import { prisma } from "@/lib/db/client";
import { bulkVerifyAll } from "@/lib/checklist";

export async function POST() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await bulkVerifyAll(prisma, { actorUsername: admin.username });
  return NextResponse.json(result);
}
