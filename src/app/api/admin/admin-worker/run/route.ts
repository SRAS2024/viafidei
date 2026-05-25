import { NextResponse, type NextRequest } from "next/server";

import { requireAdmin } from "@/lib/auth/admin";
import { runOnePass, runCleanupPass, getAdminWorkerState } from "@/lib/admin-worker";
import { prisma } from "@/lib/db/client";
import { writeAudit } from "@/lib/audit";

export const runtime = "nodejs";

const ALLOWED_PASS_TYPES = new Set([
  "diagnostics",
  "content_goal",
  "source_discovery",
  "homepage",
  "source_repair",
  "report",
  "cleanup",
  "security",
]);

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return new NextResponse("Forbidden", { status: 403 });

  let body: { passType?: string };
  try {
    body = (await req.json()) as { passType?: string };
  } catch {
    return new NextResponse("Invalid JSON body", { status: 400 });
  }
  const passType = body.passType;
  if (!passType || !ALLOWED_PASS_TYPES.has(passType)) {
    return new NextResponse(`passType must be one of ${[...ALLOWED_PASS_TYPES].join(", ")}`, {
      status: 400,
    });
  }

  // Respect pause: only the security pass runs when paused.
  const state = await getAdminWorkerState(prisma);
  if (state.paused && passType !== "security") {
    return NextResponse.json(
      { ok: false, reason: "Admin Worker is paused. Only `security` runs while paused." },
      { status: 409 },
    );
  }

  await writeAudit({
    action: "admin_worker.run_pass",
    entityType: "AdminWorkerPass",
    entityId: passType,
    actorUsername: admin.username,
  });

  if (passType === "cleanup") {
    const out = await runCleanupPass(prisma);
    return NextResponse.json({ ok: true, kind: "cleanup", result: out });
  }

  // Other pass types route through the central loop. The loop honours
  // the worker state and picks the priority that matches available
  // work; the operator-triggered pass nudges it for one cycle.
  const workerId = `admin-${admin.username}-${Date.now()}`;
  const outcome = await runOnePass(prisma, workerId);
  return NextResponse.json({ ok: true, kind: "loop_pass", result: outcome });
}
