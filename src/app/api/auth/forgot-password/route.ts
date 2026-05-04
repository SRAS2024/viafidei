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
  if (user) {
    try {
      const issued = await issuePasswordResetToken(user.id);
      logger.info("auth.password_reset.requested", {
        userId: user.id,
        requestId,
        // Never log the raw token — only the expiration.
        expiresAt: issued.expiresAt.toISOString(),
      });
      await sendPasswordResetEmail({
        user,
        token: issued.token,
        expiresAt: issued.expiresAt,
      });
    } catch (error) {
      logger.error("auth.password_reset.flow_failed", {
        userId: user.id,
        requestId,
        message: error instanceof Error ? error.message : "unknown_error",
      });
    }
  }
  // Always return the same generic success to avoid leaking which addresses are registered.
  return jsonOk({ accepted: true });
}
