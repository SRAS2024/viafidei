import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { rateLimit, RATE_POLICIES } from "@/lib/security/rate-limit";
import { reportSecurityEvent } from "@/lib/security/security-events";
import { getClientIp, getUserAgent } from "@/lib/security/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Endpoint for the client-side tamper-detection script. The browser
 * pings here whenever it spots one of the documented categories of
 * unauthorised tampering — devtools opened on a sensitive surface,
 * unexpected DOM mutation of a critical element, attempted modification
 * of read-only window state, etc. The server records the event and
 * fires the Security Breach admin email (with a 5-minute dedup window
 * to keep a single misbehaving client from flooding the mailbox).
 *
 * The endpoint is rate-limited per-IP under the existing publicRead
 * policy because anyone in the world can call it; the dedup happens
 * server-side regardless.
 */
const PayloadSchema = z.object({
  // One of the documented categories. Anything else is rejected.
  kind: z.enum([
    "client_devtools_open",
    "client_dom_tamper",
    "client_state_tamper",
    "client_storage_tamper",
    "client_csp_violation",
    "client_unauthorized_action",
  ]),
  /** Short human-readable summary of what was observed. */
  summary: z.string().min(1).max(500),
  /** Browser route the event was observed on. Stripped to a path. */
  route: z.string().max(500).optional(),
  /** Free-form detail the client provides — string values only. */
  detail: z.record(z.string(), z.string()).optional(),
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
  const userAgent = getUserAgent(req);
  const limit = await rateLimit(`security-event:${ip}`, RATE_POLICIES.publicRead, {
    ipAddress: ip,
  });
  if (!limit.ok) {
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  }

  await reportSecurityEvent({
    kind: parsed.data.kind,
    summary: parsed.data.summary,
    ipAddress: ip ?? undefined,
    userAgent: userAgent ?? undefined,
    route: parsed.data.route,
    detail: parsed.data.detail,
  });

  return NextResponse.json({ ok: true });
}
