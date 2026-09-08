import { after, type NextRequest } from "next/server";
import { z } from "zod";
import { findUserByEmail, issuePasswordResetToken } from "@/lib/auth";
import { rateLimit, RATE_POLICIES } from "@/lib/security/rate-limit";
import { getClientIp } from "@/lib/security/request";
import { checkAuthTokenStorage } from "@/lib/security/auth-storage";
import { jsonError, jsonOk, readJsonBody } from "@/lib/http";
import { logger, REQUEST_ID_HEADER } from "@/lib/observability";
import { sendPasswordResetEmail } from "@/lib/email";

// Token issuance uses node:crypto for the random + hash; pin Node runtime.
export const runtime = "nodejs";

const schema = z.object({
  email: z.string().email().max(200),
});

type RecoveryUser = NonNullable<Awaited<ReturnType<typeof findUserByEmail>>>;

/**
 * The one and only success body this endpoint returns, for every well-formed
 * request — account or no account, delivery succeeded or failed, database
 * healthy or broken.
 *
 * `sent: true` is deliberately unconditional: the client renders
 * "If an account exists for this email address, password reset instructions
 * have been sent." from it, which is true in both cases and reveals nothing.
 */
const OPAQUE_ACCEPTED_BODY = { sent: true } as const;

/**
 * Start `task` immediately and let the response go out without waiting for
 * it.
 *
 * WHY: the recovery work (token write + a network round-trip to Resend) only
 * happens when the address matches an account. Awaiting it before responding
 * would make the "account exists" path hundreds of milliseconds slower than
 * the "no account" path — a timing oracle that re-creates exactly the
 * enumeration this endpoint is supposed to close, no matter how identical
 * the bodies are. Off the response path, both cases cost one indexed lookup.
 *
 * `after()` hands the still-running promise to the Next.js runtime so the
 * request context stays alive until it settles. Outside a request scope
 * (unit tests, direct invocation) `after` throws; the promise is already
 * running by then, so the catch is only about not re-throwing.
 */
function runDetached(task: () => Promise<void>): void {
  const running = task().catch(() => {
    // Every branch inside the task logs its own outcome; this exists so a
    // throw can never surface as an unhandled rejection.
  });
  try {
    after(() => running);
  } catch {
    // No Next request scope — the detached promise still runs to completion
    // on the event loop.
  }
}

/**
 * Classify a Prisma failure for the operator log. Deliberately never
 * reaches the client: "your database is missing a table" tells an
 * unauthenticated caller more about the deployment than they should know.
 */
function classifyFlowError(message: string): string {
  if (/relation .* does not exist/i.test(message)) return "database_table_missing";
  if (/column .* does not exist/i.test(message)) return "database_column_missing";
  return "flow_error";
}

/**
 * Issue the token and send the email. Runs off the response path, so its
 * only output is structured logs — which stay as detailed as they were
 * before, because the operator still needs to diagnose an unverified sender
 * domain or a missing table from /admin/email.
 */
async function deliverPasswordReset(user: RecoveryUser, requestId: string | undefined) {
  // Fail closed rather than repairing the schema mid-request: an auth route
  // must not run DDL (see @/lib/security/auth-storage). If the token table
  // is genuinely missing, the deploy is broken and the operator log — plus
  // the startup validator that should already have refused to boot — is the
  // right place for that to show up.
  const storage = await checkAuthTokenStorage();
  if (!storage.ok) {
    logger.error("auth.password_reset.storage_unavailable", {
      userId: user.id,
      requestId,
      reason: storage.reason,
      ...(storage.reason === "missing_tables"
        ? { missing: storage.missing }
        : { detail: storage.detail }),
    });
    return;
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
      // Resend rejected the send. The structured fields (errorName /
      // errorMessage — never the API key, never the email body) are what
      // the admin diagnostic renders.
      logger.error("auth.password_reset.email_undelivered", {
        userId: user.id,
        requestId,
        reason: delivery.reason,
        errorName: delivery.errorName,
        errorMessage: delivery.errorMessage,
        statusCode: delivery.statusCode,
      });
      return;
    }
    if (delivery.delivery === "skipped") {
      // No Resend API key: nothing was sent. Logged at error level so the
      // operator notices that password recovery is silently inert.
      logger.error("auth.password_reset.email_skipped", {
        userId: user.id,
        requestId,
        reason: "not_configured",
      });
      return;
    }
    logger.info("auth.password_reset.sent", {
      userId: user.id,
      requestId,
      delivery: delivery.delivery,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    logger.error("auth.password_reset.flow_failed", {
      userId: user.id,
      requestId,
      kind: classifyFlowError(message),
      message,
    });
  }
}

/**
 * POST /api/auth/forgot-password
 *
 * Enumeration-safe by construction: a well-formed request always gets the
 * same 200 and the same body, whether or not the address belongs to an
 * account. An earlier revision returned 404 `not_found` for unknown
 * addresses and leaked Resend's error text for known ones, which let anyone
 * confirm membership one address at a time and read deployment internals
 * while doing it.
 *
 * The two status codes that remain distinguishable are properties of the
 * *request*, not of the account: 400 for a malformed email, 429 for the
 * per-IP rate limit. Neither one varies with whether the account exists.
 *
 * Every downstream protection is unchanged — 32 random bytes per token,
 * SHA-256 hashed at rest, 15-minute expiry, single use, sibling tokens
 * invalidated on consume, and all sessions torn down after the password
 * rotates (see @/lib/auth/tokens).
 */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const limit = await rateLimit(`forgot:${ip}`, RATE_POLICIES.passwordReset, { ipAddress: ip });
  if (!limit.ok) {
    // Tell the caller how long they have to wait so the form can render
    // a precise message ("try again in N minutes") instead of an opaque
    // "too many requests". Independent of account existence.
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
  let user: RecoveryUser | null = null;
  try {
    user = await findUserByEmail(parsed.data.email);
  } catch (error) {
    // A lookup failure must not become a distinguishable response either —
    // otherwise a caller could probe the database's health through it.
    logger.error("auth.password_reset.lookup_failed", {
      requestId,
      message: error instanceof Error ? error.message : "unknown_error",
    });
  }

  const found = user;
  if (found) {
    runDetached(() => deliverPasswordReset(found, requestId));
  } else {
    // Internal diagnostics keep the real outcome. The address itself is not
    // logged: an unauthenticated caller should not be able to fill the
    // operator's log with addresses they are probing.
    logger.info("auth.password_reset.no_account", { requestId });
  }

  return jsonOk(OPAQUE_ACCEPTED_BODY);
}
