import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { rateLimit, RATE_POLICIES } from "@/lib/security/rate-limit";
import { recordError } from "@/lib/data/error-log";
import { reportCriticalFailure } from "@/lib/data/admin-notifications";
import { getClientIp } from "@/lib/security/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Endpoint for the React global error boundary to escalate
 * site-crash-class failures. The boundary only renders when the React
 * tree cannot recover, so anything posted here is by definition
 * critical: ErrorLog gets a critical-severity row and the operator
 * receives an immediate Critical Failure email.
 *
 * The endpoint is rate-limited per-IP under publicRead — the boundary
 * cannot post more than that per minute even if it re-fires.
 */
const PayloadSchema = z.object({
  kind: z.string().min(1).max(120),
  message: z.string().min(1).max(2000),
  stack: z.string().max(8000).optional(),
  route: z.string().max(500).optional(),
  digest: z.string().max(120).optional(),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }
  const parsed = PayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }

  const ip = getClientIp(req);
  const limit = await rateLimit(`critical-failure:${ip}`, RATE_POLICIES.publicRead, {
    ipAddress: ip,
  });
  if (!limit.ok) {
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  }

  await recordError({
    source: "global",
    kind: parsed.data.kind,
    message: parsed.data.message,
    stack: parsed.data.stack,
    route: parsed.data.route,
    severity: "critical",
    context: parsed.data.digest ? { digest: parsed.data.digest } : undefined,
  });
  await reportCriticalFailure({
    kind: parsed.data.kind,
    message: parsed.data.message,
    stack: parsed.data.stack,
    context: {
      ...(parsed.data.route ? { route: parsed.data.route } : {}),
      ...(parsed.data.digest ? { digest: parsed.data.digest } : {}),
    },
  });

  return NextResponse.json({ ok: true });
}
