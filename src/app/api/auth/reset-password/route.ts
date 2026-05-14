import { type NextRequest } from "next/server";
import { consumePasswordResetToken, resetPasswordSchema } from "@/lib/auth";
import { rateLimit, RATE_POLICIES } from "@/lib/security/rate-limit";
import { getClientIp } from "@/lib/security/request";
import { jsonError, jsonOk, readJsonBody } from "@/lib/http";
import { logger, REQUEST_ID_HEADER } from "@/lib/observability";

// Argon2 hash + node:crypto for the token comparison need the Node runtime.
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const limit = await rateLimit(`reset:${ip}`, RATE_POLICIES.passwordReset, { ipAddress: ip });
  if (!limit.ok) return jsonError("rate_limited");

  const body = await readJsonBody(req);
  if (!body.ok) return jsonError("invalid");
  const parsed = resetPasswordSchema.safeParse(body.data);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    if (issue?.message === "mismatch") {
      return jsonError("invalid", { message: "mismatch" });
    }
    if (issue?.message === "weak") {
      return jsonError("invalid", { message: "weak" });
    }
    return jsonError("invalid", { details: parsed.error.flatten() });
  }

  const requestId = req.headers.get(REQUEST_ID_HEADER) ?? undefined;
  let result: Awaited<ReturnType<typeof consumePasswordResetToken>>;
  try {
    result = await consumePasswordResetToken(parsed.data.token, parsed.data.password);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const kind = /relation .* does not exist/i.test(message)
      ? "database_table_missing"
      : /column .* does not exist/i.test(message)
        ? "database_column_missing"
        : "db_error";
    logger.error("auth.password_reset.consume_failed", {
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
  // Successful consume: password rotated, token marked used, all other
  // outstanding reset tokens for this user invalidated, and every
  // active session torn down. See `consumePasswordResetToken`.
  logger.info("auth.password_reset.success", {
    requestId,
    userId: result.userId,
  });
  return jsonOk({ reset: true });
}
