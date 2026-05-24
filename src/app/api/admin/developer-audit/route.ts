import { NextResponse, type NextRequest } from "next/server";
import type { AdminDeveloperReportPeriod } from "@prisma/client";

import { requireAdmin } from "@/lib/auth/admin";
import { prisma } from "@/lib/db/client";
import { generateAdminWorkerDeveloperAuditPdf } from "@/lib/admin-worker/pdf";
import { DEVELOPER_AUDIT_SECTIONS } from "@/lib/admin-worker";
import { writeAudit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_PERIODS = new Set<AdminDeveloperReportPeriod>([
  "LAST_24_HOURS",
  "LAST_7_DAYS",
  "LAST_30_DAYS",
]);

/**
 * POST /api/admin/developer-audit
 *
 * Spec section 12: protected admin route that generates and returns
 * the Developer Audit PDF for the chosen period.
 *
 * Body:
 *   { period: "LAST_24_HOURS" | "LAST_7_DAYS" | "LAST_30_DAYS",
 *     sections?: string[] }
 *
 * Returns the PDF directly as application/pdf so the diagnostics page
 * can offer it as a download.
 */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return new NextResponse("Forbidden", { status: 403 });

  let body: { period?: string; sections?: string[] } = {};
  try {
    body = (await req.json()) as { period?: string; sections?: string[] };
  } catch {
    body = {};
  }

  const rawPeriod = body.period ?? "LAST_24_HOURS";
  const period = (
    VALID_PERIODS.has(rawPeriod as AdminDeveloperReportPeriod) ? rawPeriod : "LAST_24_HOURS"
  ) as AdminDeveloperReportPeriod;

  const sections =
    body.sections && body.sections.length > 0
      ? (body.sections.filter((s) =>
          (DEVELOPER_AUDIT_SECTIONS as readonly string[]).includes(s),
        ) as Array<(typeof DEVELOPER_AUDIT_SECTIONS)[number]>)
      : undefined;

  await writeAudit({
    action: "admin_worker.developer_audit",
    entityType: "AdminDeveloperReportLog",
    entityId: period,
    actorUsername: admin.username,
  });

  const { pdf } = await generateAdminWorkerDeveloperAuditPdf(prisma, period, admin.username, {
    includedSections: sections,
  });

  const filename = `viafidei-developer-audit-${period.toLowerCase()}-${new Date()
    .toISOString()
    .replace(/[:.]/g, "-")}.pdf`;

  return new NextResponse(pdf as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
