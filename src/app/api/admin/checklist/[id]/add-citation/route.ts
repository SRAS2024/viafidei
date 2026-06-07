import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/admin";
import { prisma } from "@/lib/db/client";
import { addCitation } from "@/lib/checklist";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    sourceUrl?: string;
    title?: string;
    excerpt?: string;
  };
  if (!body.sourceUrl) {
    return NextResponse.json({ error: "sourceUrl required" }, { status: 400 });
  }
  const result = await addCitation(prisma, {
    checklistItemId: id,
    sourceUrl: body.sourceUrl,
    title: body.title,
    excerpt: body.excerpt,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 400 });
  }
  return NextResponse.json(result);
}
