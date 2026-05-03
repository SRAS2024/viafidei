import { NextResponse } from "next/server";

// Liveness probe. Used by Railway's deploy healthcheck and the Dockerfile
// HEALTHCHECK directive. Returns 200 as long as the Node process is up and
// the HTTP listener is responding — deliberately does NOT touch the
// database, so a transient DB blip during deploy can't fail the deploy.
//
// /api/health is the readiness/diagnostic endpoint with full DB and table
// status; that's what monitoring should hit, not the deploy probe.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export function GET() {
  return NextResponse.json({
    status: "live",
    service: "viafidei-web",
    timestamp: Date.now(),
  });
}
