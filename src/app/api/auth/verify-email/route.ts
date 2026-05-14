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

// Token issuance + Prisma writes need the Node runtime.
export const runtime = "nodejs";

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

  const requestId = req.headers.get(REQUEST_ID_HEADER) ?? undefined;
  let result: Awaited<ReturnType<typeof consumeEmailVerificationToken>>;
  try {
    result = await consumeEmailVerificationToken(parsed.data.token);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const kind = /relation .* does not exist/i.test(message)
      ? "database_table_missing"
      : /column .* does not exist/i.test(message)
        ? "database_column_missing"
        : "db_error";
    logger.error("auth.email_verification.consume_failed", {
      requestId,
      kind,
      message,
    });
    return jsonError("server_error", { message: "consume_failed" });
  }
  if (!result.ok) {
    if (result.reason === "not_found") return jsonError("not_found");
    return jsonError("invalid", { message: result.reason });
  }
  // Success: User.emailVerifiedAt is now set, the token is marked used
  // (cannot be replayed), and the unverified-email banner on /profile
  // hides on the next render.
  logger.info("auth.email_verification.success", {
    requestId,
    userId: result.userId,
  });
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

  let issued;
  try {
    issued = await issueEmailVerificationToken(user.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const kind = /relation .* does not exist/i.test(message)
      ? "database_table_missing"
      : /column .* does not exist/i.test(message)
        ? "database_column_missing"
        : "token_creation_failed";
    logger.error("auth.email_verification.token_creation_failed", {
      userId: user.id,
      requestId,
      kind,
      message,
    });
    return jsonError("server_error", { message: "token_creation_failed" });
  }
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
      errorName: result.errorName,
      errorMessage: result.errorMessage,
    });
    return jsonError("server_error", {
      message: "delivery_failed",
      details: { reason: result.reason },
    });
  }
  if (result.delivery === "skipped") {
    logger.error("auth.email_verification.email_skipped", {
      userId: user.id,
      requestId,
      reason: "not_configured",
    });
    return jsonError("server_error", {
      message: "email_not_configured",
      details: { reason: "not_configured" },
    });
  }
  return jsonOk({ requested: true });
}
