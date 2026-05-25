import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/admin";
import { runAllDiagnostics } from "@/lib/diagnostics";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const results = await runAllDiagnostics();
  return NextResponse.json({ results });
}
