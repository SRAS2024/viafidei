import { type NextRequest } from "next/server";
import { z } from "zod";
import {
  consumeEmailVerificationToken,
  issueEmailVerificationToken,
  requireUser,
} from "@/lib/auth";
import { prisma } from "@/lib/db";
import { rateLimit, RATE_POLICIES } from "@/lib/security/rate-limit";
import { getClientIp } from "@/lib/security/request";
import { jsonError, jsonOk, readJsonBody } from "@/lib/http";
import { logger, REQUEST_ID_HEADER } from "@/lib/observability";
import { sendEmailVerificationEmail } from "@/lib/email";

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

  if (user.emailVerifiedAt) {
    return jsonError("conflict", { message: "already_verified" });
  }

  const limit = await rateLimit(`verify-email-issue:${user.id}`, RATE_POLICIES.emailVerification, {
    userId: user.id,
  });
  if (!limit.ok) return jsonError("rate_limited");

  const requestId = req.headers.get(REQUEST_ID_HEADER) ?? undefined;
  // Refresh the language each time so the email is sent in the user's
  // currently saved language.
  const fresh = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      language: true,
    },
  });
  if (!fresh) return jsonError("unauthorized");

  const issued = await issueEmailVerificationToken(user.id);
  logger.info("auth.email_verification.requested", {
    userId: user.id,
    requestId,
    expiresAt: issued.expiresAt.toISOString(),
  });
  const result = await sendEmailVerificationEmail({
    user: fresh,
    token: issued.token,
    expiresAt: issued.expiresAt,
  });
  if (!result.ok) {
    logger.error("auth.email_verification.email_failed", {
      userId: user.id,
      requestId,
      reason: result.reason,
    });
  }
  return jsonOk({ requested: true });
}
