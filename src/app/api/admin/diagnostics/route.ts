import { NextResponse, type NextRequest } from "next/server";

import { gateAdminApiCall } from "@/lib/security/admin-gate";
import { runAllDiagnostics } from "@/lib/diagnostics";

export async function GET(req: NextRequest) {
  // Read-only, but still through the central gate: CSRF is a no-op on a safe
  // method while banned-device and admin-session enforcement still apply.
  const gate = await gateAdminApiCall(req);
  if (!gate.ok) return gate.response;

  const results = await runAllDiagnostics();
  return NextResponse.json({ results });
}
