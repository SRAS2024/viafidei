import { NextResponse, type NextRequest } from "next/server";

import { requireAdmin } from "@/lib/auth/admin";
import { runOnePass, runCleanupPass, getAdminWorkerState } from "@/lib/admin-worker";
import {
  runOperatorPass,
  FORCED_OPERATOR_PASSES,
  type OperatorPassType,
} from "@/lib/admin-worker/operator-passes";
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

  const workerId = `admin-${admin.username}-${Date.now()}`;

  if (passType === "cleanup") {
    const out = await runCleanupPass(prisma);
    return NextResponse.json({ ok: true, kind: "cleanup", result: out });
  }

  // Deterministic operator control: the six single-stage buttons dispatch the
  // EXACT requested stage (forced), rather than routing through the brain's
  // scoring — so "Run diagnostics" always runs diagnostics, "Run source
  // discovery" always runs discovery, etc. Each runs through the same
  // dispatcher + pass lifecycle as an autonomous pass, so it shows correctly in
  // Recent Passes and is liveness-safe.
  if (FORCED_OPERATOR_PASSES.includes(passType as OperatorPassType)) {
    const result = await runOperatorPass(prisma, passType as OperatorPassType, {
      workerId,
      source: "operator",
    });
    return NextResponse.json({ ok: result.ok, kind: "operator_pass", result });
  }

  // content_goal: run the full autonomous pipeline — advancing content toward
  // its goals IS the whole brain-driven pass, not a single stage.
  const outcome = await runOnePass(prisma, workerId);
  return NextResponse.json({ ok: true, kind: "loop_pass", result: outcome });
}
