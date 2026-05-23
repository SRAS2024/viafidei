import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/admin";
import { prisma } from "@/lib/db/client";
import { rejectItem } from "@/lib/worker";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { reason?: string };
  const reason = body.reason ?? "no reason supplied";
  await rejectItem(prisma, id, reason, admin.username);
  return NextResponse.json({ ok: true });
}
