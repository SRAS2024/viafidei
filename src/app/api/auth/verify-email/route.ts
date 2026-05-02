import { type NextRequest } from "next/server";
import { z } from "zod";
import {
  consumeEmailVerificationToken,
  issueEmailVerificationToken,
  requireUser,
} from "@/lib/auth";
import { rateLimit, RATE_POLICIES } from "@/lib/security/rate-limit";
import { getClientIp } from "@/lib/security/request";
import { jsonError, jsonOk, readJsonBody } from "@/lib/http";
import { logger, REQUEST_ID_HEADER } from "@/lib/observability";

const consumeSchema = z.object({ token: z.string().min(20).max(256) });

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const limit = await rateLimit(`verify-email:${ip}`, RATE_POLICIES.emailVerification, {
    ipAddress: ip,
  });
  if (!limit.ok) return jsonError("rate_limited");

  const body = await readJsonBody(req);
  if (!body.ok) return jsonError("invalid");
  const parsed = consumeSchema.safeParse(body.data);
  if (!parsed.success) return jsonError("invalid", { details: parsed.error.flatten() });

  const result = await consumeEmailVerificationToken(parsed.data.token);
  if (!result.ok) {
    if (result.reason === "not_found") return jsonError("not_found");
    return jsonError("invalid", { message: result.reason });
  }
  return jsonOk({ verified: true });
}

export async function PUT(req: NextRequest) {
  const user = await requireUser();
  if (!user) return jsonError("unauthorized");

  const limit = await rateLimit(`verify-email-issue:${user.id}`, RATE_POLICIES.emailVerification, {
    userId: user.id,
  });
  if (!limit.ok) return jsonError("rate_limited");

  const issued = await issueEmailVerificationToken(user.id);
  logger.info("auth.email_verification.requested", {
    userId: user.id,
    requestId: req.headers.get(REQUEST_ID_HEADER) ?? undefined,
    expiresAt: issued.expiresAt.toISOString(),
  });
  return jsonOk({ requested: true });
}
