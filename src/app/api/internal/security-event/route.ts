import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { rateLimit, RATE_POLICIES } from "@/lib/security/rate-limit";
import { reportSecurityBreach, reportSuspiciousActivity } from "@/lib/security/security-events";
import { recordTamperEvent } from "@/lib/security/tamper-counter";
import { getClientIp, getUserAgent } from "@/lib/security/request";
import { DEVICE_CREDENTIAL_COOKIE } from "@/middleware";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Endpoint for the client-side tamper-detection script. The browser
 * pings here whenever it spots one of the documented categories of
 * unauthorised behavior. The server classifies the event:
 *
 *   * Just opening devtools (`client_devtools_open`) is benign —
 *     a single isolated event does not page the admin. SUSTAINED
 *     probing (more than 3 client tamper events from the same
 *     IP + device within a 10-minute window) escalates to a
 *     Suspicious Activity email.
 *
 *   * Active manipulation events (DOM tamper, state tamper,
 *     storage tamper, CSP violation, unauthorised action) are
 *     active attack attempts and fire a Security Breach email
 *     immediately.
 *
 * Both classifications dedup at the security-events layer, so a
 * misbehaving client cannot flood the admin mailbox.
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

/**
 * Active-attack events that always escalate to Security Breach.
 * `client_devtools_open` is intentionally NOT in this set — it is
 * benign on its own, only sustained probing escalates.
 */
const ALWAYS_BREACH_KINDS = new Set([
  "client_dom_tamper",
  "client_state_tamper",
  "client_storage_tamper",
  "client_csp_violation",
  "client_unauthorized_action",
]);

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
  const deviceCredential = req.cookies.get(DEVICE_CREDENTIAL_COOKIE)?.value ?? null;
  const limit = await rateLimit(`security-event:${ip}`, RATE_POLICIES.publicRead, {
    ipAddress: ip,
  });
  if (!limit.ok) {
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  }

  const baseInput = {
    kind: parsed.data.kind,
    summary: parsed.data.summary,
    ipAddress: ip ?? undefined,
    userAgent: userAgent ?? undefined,
    route: parsed.data.route,
    deviceCredential: deviceCredential ?? undefined,
    attemptedAction: parsed.data.kind,
    detail: parsed.data.detail,
  };

  if (ALWAYS_BREACH_KINDS.has(parsed.data.kind)) {
    await reportSecurityBreach(baseInput);
    return NextResponse.json({ ok: true, classification: "Breach" });
  }

  // Devtools-open: only escalate on sustained probing.
  const tamper = recordTamperEvent({
    ipAddress: ip ?? null,
    deviceCredential: deviceCredential ?? null,
  });
  if (tamper.classification === "suspicious") {
    await reportSuspiciousActivity({
      ...baseInput,
      summary: `Sustained client tamper probing — ${tamper.count} events within ${Math.round(tamper.windowMs / 60000)} minutes (${parsed.data.summary})`,
      recommendedAction:
        "Investigate whether the device is running a legitimate admin tool or an attempted probe; consider escalating to a Security Breach if a follow-up active-tamper event is observed.",
    });
    return NextResponse.json({ ok: true, classification: "Suspicious" });
  }

  // Isolated benign event — log only, no admin alert.
  return NextResponse.json({ ok: true, classification: "benign" });
}
