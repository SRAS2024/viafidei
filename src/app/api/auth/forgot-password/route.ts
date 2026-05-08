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
      // The token was issued but the email never went out — surface that
      // to the caller instead of pretending it succeeded. Otherwise the
      // user keeps watching an empty inbox and has no way to know
      // anything is wrong.
      logger.error("auth.password_reset.email_undelivered", {
        userId: user.id,
        requestId,
        reason: delivery.reason,
        errorName: delivery.errorName,
        errorMessage: delivery.errorMessage,
      });
      return jsonError("server_error", {
        message: "delivery_failed",
        details: { reason: delivery.reason },
      });
    }
    if (delivery.delivery === "skipped") {
      // Provider not configured (RESEND_API_KEY missing). Surface as
      // "we couldn't send" so the user knows to contact support and
      // doesn't keep refreshing their inbox.
      logger.error("auth.password_reset.email_skipped", {
        userId: user.id,
        requestId,
        reason: "not_configured",
      });
      return jsonError("server_error", {
        message: "email_not_configured",
        details: { reason: "not_configured" },
      });
    }
  } catch (error) {
    logger.error("auth.password_reset.flow_failed", {
      userId: user.id,
      requestId,
      message: error instanceof Error ? error.message : "unknown_error",
    });
    return jsonError("server_error", { message: "delivery_failed" });
  }
  return jsonOk({ sent: true, email: user.email });
}
