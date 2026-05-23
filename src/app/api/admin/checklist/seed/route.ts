import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/admin";
import { prisma } from "@/lib/db/client";
import { seedChecklistFirst } from "@/lib/worker/seed";

export async function POST() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await seedChecklistFirst(prisma);
  return NextResponse.json({ ok: true, ...result });
}
