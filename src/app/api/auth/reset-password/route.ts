import { type NextRequest } from "next/server";
import { consumePasswordResetToken, resetPasswordSchema } from "@/lib/auth";
import { rateLimit, RATE_POLICIES } from "@/lib/security/rate-limit";
import { getClientIp, redirectTo } from "@/lib/security/request";
import { isFormPost, jsonError, jsonOk, readFormBody, readJsonBody } from "@/lib/http";
import { logger, REQUEST_ID_HEADER } from "@/lib/observability";

// Argon2 hash + node:crypto for the token comparison need the Node runtime.
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  // The form sends JSON once its script has run. Pressed before that, or where script never
  // runs, it is a plain post, whose answer has to be a page: back to the form with the
  // reason, under the link's own token. The passwords go nowhere near that URL.
  const plainPost = isFormPost(req);
  const posted = plainPost ? await readFormBody(req) : null;
  const form = posted?.ok ? posted.form : null;
  const refuse = (reason: string, jsonAnswer: Response): Response => {
    if (!plainPost) return jsonAnswer;
    const token = form?.get("token");
    const query = new URLSearchParams({ error: reason });
    if (typeof token === "string" && token) query.set("token", token.slice(0, 256));
    return redirectTo(req, `/reset-password?${query}`);
  };

  const ip = getClientIp(req);
  const limit = await rateLimit(`reset:${ip}`, RATE_POLICIES.passwordReset, { ipAddress: ip });
  if (!limit.ok) return refuse("rate_limited", jsonError("rate_limited"));

  let input: unknown = {
    token: form?.get("token"),
    password: form?.get("password"),
    passwordConfirm: form?.get("passwordConfirm"),
  };
  if (!plainPost) {
    const body = await readJsonBody(req);
    if (!body.ok) return jsonError("invalid");
    input = body.data;
  }
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    if (issue?.message === "mismatch") {
      return refuse("mismatch", jsonError("invalid", { message: "mismatch" }));
    }
    if (issue?.message === "weak") {
      return refuse("weak", jsonError("invalid", { message: "weak" }));
    }
    // Nothing typed is at fault if the link's token is what failed, and only a new link helps.
    return refuse(
      issue?.path[0] === "token" ? "not_found" : "invalid",
      jsonError("invalid", { details: parsed.error.flatten() }),
    );
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
    return refuse("server_error", jsonError("server_error", { message: "consume_failed" }));
  }
  if (!result.ok) {
    if (result.reason === "not_found") return refuse("not_found", jsonError("not_found"));
    return refuse(result.reason, jsonError("invalid", { message: result.reason }));
  }
  // Successful consume: password rotated, token marked used, all other
  // outstanding reset tokens for this user invalidated, and every
  // active session torn down. See `consumePasswordResetToken`.
  logger.info("auth.password_reset.success", {
    requestId,
    userId: result.userId,
  });
  if (plainPost) return redirectTo(req, "/login?notice=password_reset");
  return jsonOk({ reset: true });
}
