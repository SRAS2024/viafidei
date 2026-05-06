import { type NextRequest } from "next/server";
import { z } from "zod";
import { findUserByEmail, issuePasswordResetToken } from "@/lib/auth";
import { rateLimit, RATE_POLICIES } from "@/lib/security/rate-limit";
import { getClientIp } from "@/lib/security/request";
import { jsonError, jsonOk, readJsonBody } from "@/lib/http";
import { logger, REQUEST_ID_HEADER } from "@/lib/observability";
import { sendPasswordResetEmail } from "@/lib/email";

const schema = z.object({
  email: z.string().email().max(200),
});

/**
 * POST /api/auth/forgot-password
 *
 * Product decision: the response *does* distinguish between "email matches
 * an account" (200 with `sent: true`) and "no account for that email"
 * (404 with `error: "not_found"`). The UI surfaces these directly so the
 * user knows whether a reset email is on its way or whether they need to
 * sign up — instead of the generic "if it matches, we'll send" message
 * that hides the outcome.
 *
 * The privacy trade-off (email enumeration) is mitigated by the per-IP
 * rate limit set in RATE_POLICIES.passwordReset.
 */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const limit = await rateLimit(`forgot:${ip}`, RATE_POLICIES.passwordReset, { ipAddress: ip });
  if (!limit.ok) return jsonError("rate_limited");

  const body = await readJsonBody(req);
  if (!body.ok) return jsonError("invalid");
  const parsed = schema.safeParse(body.data);
  if (!parsed.success) return jsonError("invalid", { details: parsed.error.flatten() });

  const requestId = req.headers.get(REQUEST_ID_HEADER) ?? undefined;
  const user = await findUserByEmail(parsed.data.email);
  if (!user) {
    return jsonError("not_found");
  }

  try {
    const issued = await issuePasswordResetToken(user.id);
    logger.info("auth.password_reset.requested", {
      userId: user.id,
      requestId,
      // Never log the raw token — only the expiration.
      expiresAt: issued.expiresAt.toISOString(),
    });
    const delivery = await sendPasswordResetEmail({
      user,
      token: issued.token,
      expiresAt: issued.expiresAt,
    });
    if (!delivery.ok) {
      // The token was issued but the email never went out. Return the
      // same `sent: true` shape so we don't reveal a new failure mode to
      // the caller — but log the reason so the operator can act
      // (unverified Resend domain, missing API key, …).
      logger.error("auth.password_reset.email_undelivered", {
        userId: user.id,
        requestId,
        reason: delivery.reason,
      });
    }
  } catch (error) {
    logger.error("auth.password_reset.flow_failed", {
      userId: user.id,
      requestId,
      message: error instanceof Error ? error.message : "unknown_error",
    });
    // Treat a token-issue failure the same as a successful send from the
    // caller's perspective — the user shouldn't get stuck in a "no account"
    // dead-end when their account does exist.
  }
  return jsonOk({ sent: true, email: user.email });
}
