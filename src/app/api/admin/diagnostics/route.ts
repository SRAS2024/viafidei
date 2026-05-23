import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/admin";
import { buildDeveloperReport, runAllDiagnostics } from "@/lib/diagnostics";

export async function POST() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const results = await runAllDiagnostics();
  const markdown = buildDeveloperReport(results);
  return NextResponse.json({ ok: true, results, markdown });
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const results = await runAllDiagnostics();
  return NextResponse.json({ results });
}
