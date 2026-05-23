import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/admin";
import { prisma } from "@/lib/db/client";
import { unpublish } from "@/lib/worker";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await context.params;
  let reason: string | undefined;
  try {
    const body = await request.json();
    if (body && typeof body.reason === "string") reason = body.reason;
  } catch {}
  const result = await unpublish(prisma, id, admin.username, reason);
  return NextResponse.json(result);
}
