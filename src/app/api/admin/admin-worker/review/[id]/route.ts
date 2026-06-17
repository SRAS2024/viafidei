import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/admin";
import { resolveReview } from "@/lib/admin-worker";
import { prisma } from "@/lib/db/client";
import { writeAudit } from "@/lib/audit";

export const runtime = "nodejs";

/**
 * Human-review decision endpoint.
 *
 *   POST → { decision: "APPROVED" | "REJECTED", notes? }
 *
 * Admin-guarded + audited. On APPROVED the proposed change is actually applied
 * (e.g. a confirmed Latin/Greek translation is written onto the published
 * prayer) — not just a status flip — via resolveReview's executor.
 */
const postSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  notes: z.string().max(2000).optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return new NextResponse("Forbidden", { status: 403 });

  const { id } = await params;
  const parsed = postSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const result = await resolveReview(prisma, id, {
    status: parsed.data.decision,
    byUsername: admin.username,
    notes: parsed.data.notes,
  });

  await writeAudit({
    action: `admin_worker.review.${parsed.data.decision.toLowerCase()}`,
    entityType: "HumanReviewQueue",
    entityId: id,
    actorUsername: admin.username,
  });

  return NextResponse.json({
    ok: true,
    decision: parsed.data.decision,
    applied: result.applied,
    detail: result.detail,
  });
}
