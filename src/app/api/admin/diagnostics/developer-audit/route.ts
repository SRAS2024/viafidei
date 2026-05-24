import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/admin";
import { generateDeveloperAuditPdf, type AuditPeriod } from "@/lib/diagnostics/developer-audit";

const VALID_PERIODS = new Set<AuditPeriod>(["24h", "week", "month"]);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/diagnostics/developer-audit?period=24h|week|month
 *
 * Returns a PDF download containing the full developer audit for the
 * selected period: diagnostics, QA reports, worker build logs, recent
 * builds, and curated knowledge availability.
 */
export async function GET(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = new URL(request.url);
  const rawPeriod = url.searchParams.get("period") ?? "24h";
  const period = (VALID_PERIODS.has(rawPeriod as AuditPeriod) ? rawPeriod : "24h") as AuditPeriod;
  const pdf = await generateDeveloperAuditPdf(period);
  const filename = `viafidei-developer-audit-${period}-${new Date()
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
