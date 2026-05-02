import { type NextRequest } from "next/server";
import { z } from "zod";
import { findUserByEmail, issuePasswordResetToken } from "@/lib/auth";
import { rateLimit, RATE_POLICIES } from "@/lib/security/rate-limit";
import { getClientIp } from "@/lib/security/request";
import { jsonError, jsonOk, readJsonBody } from "@/lib/http";
import { logger, REQUEST_ID_HEADER } from "@/lib/observability";

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
    const issued = await issuePasswordResetToken(user.id);
    // The actual email delivery is handled by an external mailer (Postmark) once
    // wired up; for now, log the token issuance for ops to forward.
    logger.info("auth.password_reset.requested", {
      userId: user.id,
      requestId,
      expiresAt: issued.expiresAt.toISOString(),
    });
  }
  // Always return ok to avoid leaking which addresses are registered.
  return jsonOk({ accepted: true });
}
