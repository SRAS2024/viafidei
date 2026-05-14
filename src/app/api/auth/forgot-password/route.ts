import { type NextRequest } from "next/server";
import { z } from "zod";
import { findUserByEmail, issuePasswordResetToken } from "@/lib/auth";
import { rateLimit, RATE_POLICIES } from "@/lib/security/rate-limit";
import { getClientIp } from "@/lib/security/request";
import { jsonError, jsonOk, readJsonBody } from "@/lib/http";
import { logger, REQUEST_ID_HEADER } from "@/lib/observability";
import { sendPasswordResetEmail } from "@/lib/email";

// Token issuance uses node:crypto for the random + hash; pin Node runtime.
export const runtime = "nodejs";

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
  if (!limit.ok) {
    // Tell the caller how long they have to wait so the form can render
    // a precise message ("try again in N minutes") instead of an opaque
    // "too many requests".
    const retryAfterSeconds = Math.max(1, Math.ceil((limit.resetAt - Date.now()) / 1000));
    return jsonError("rate_limited", {
      details: { retryAfterSeconds },
    });
  }

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
      // anything is wrong. We pass through Resend's structured `errorName`
      // and `errorMessage` (NOT the API key, NOT the email body) so an
      // operator looking at the network tab can see the actual cause
      // (validation_error / restricted_api_key / …) without first
      // signing into the admin diagnostic page.
      logger.error("auth.password_reset.email_undelivered", {
        userId: user.id,
        requestId,
        reason: delivery.reason,
        errorName: delivery.errorName,
        errorMessage: delivery.errorMessage,
      });
      return jsonError("server_error", {
        message: "delivery_failed",
        details: {
          reason: delivery.reason,
          errorName: delivery.errorName,
          errorMessage: delivery.errorMessage,
          statusCode: delivery.statusCode,
        },
      });
    }
    if (delivery.delivery === "skipped") {
      // Provider not configured (no Resend API key). Surface as
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
    const message = error instanceof Error ? error.message : "unknown_error";
    // Translate Prisma's "relation does not exist" / "column does not
    // exist" into structured kinds so the operator log line names the
    // missing piece. The user-visible response carries
    // `token_creation_failed` (not `delivery_failed`) so the admin can
    // see in the network tab that this is a database problem, not a
    // Resend problem — the corresponding banner on /admin/email points
    // at the missing table.
    const isMissingTable = /relation .* does not exist/i.test(message);
    const isMissingColumn = /column .* does not exist/i.test(message);
    const kind = isMissingTable
      ? "database_table_missing"
      : isMissingColumn
        ? "database_column_missing"
        : "flow_error";
    logger.error("auth.password_reset.flow_failed", {
      userId: user.id,
      requestId,
      kind,
      message,
    });
    if (isMissingTable || isMissingColumn) {
      return jsonError("server_error", {
        message: "token_creation_failed",
        details: { reason: kind },
      });
    }
    return jsonError("server_error", { message: "delivery_failed" });
  }
  return jsonOk({ sent: true, email: user.email });
}
