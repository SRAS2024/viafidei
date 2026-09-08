import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/db/client";
import { gateAdminApiCall } from "@/lib/security/admin-gate";
import { addCitation } from "@/lib/checklist";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const gate = await gateAdminApiCall(request);
  if (!gate.ok) return gate.response;

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
