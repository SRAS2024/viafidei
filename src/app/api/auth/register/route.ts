import { type NextRequest } from "next/server";
import { cookies } from "next/headers";
import {
  createUser,
  registerSchema,
  findUserByEmail,
  getSession,
  issueEmailVerificationToken,
} from "@/lib/auth";
import { ensureAccountEmailTables } from "@/lib/startup/ensure-email-tables";
import { rateLimit, RATE_POLICIES } from "@/lib/security/rate-limit";
import { getClientIp, redirectTo } from "@/lib/security/request";
import { sendWelcomeEmail } from "@/lib/email";
import { logger, REQUEST_ID_HEADER } from "@/lib/observability";
import { logApiError } from "@/lib/observability/page-errors";
import { LOCALE_COOKIE_NAME, LOCALE_COOKIE_OPTIONS } from "@/lib/i18n/cookie";
import { isSupportedLocale } from "@/lib/i18n/locales";
import { negotiateLocale } from "@/lib/i18n/negotiate";

function classifyError(parsed: ReturnType<typeof registerSchema.safeParse>): string {
  if (parsed.success) return "invalid";
  const issue = parsed.error.issues[0];
  if (issue?.message === "mismatch") return "mismatch";
  if (issue?.path.includes("password")) return "weak";
  return "invalid";
}

function resolveLocaleFromRequest(req: NextRequest, override?: string | null): string {
  if (override && isSupportedLocale(override)) return override;
  const cookie = cookies().get(LOCALE_COOKIE_NAME)?.value;
  if (cookie && isSupportedLocale(cookie)) return cookie;
  return negotiateLocale(req.headers.get("accept-language"));
}

function redirectWithError(req: NextRequest, code: string) {
  return redirectTo(req, `/register?error=${code}`);
}

/**
 * Re-classify a Prisma write error so account-creation failures land in the
 * logs with a kind that explains *what* schema piece is broken, not just
 * "create_failed". Anything matching User/Session/Profile/PasswordResetToken/
 * EmailVerificationToken in a "relation does not exist" or "column does not
 * exist" error is fatal for sign-up; surfacing that in logs lets the
 * operator run migrations rather than chase a generic 500.
 */
function describeWriteError(error: unknown): {
  kind: string;
  table?: string;
  message: string;
} {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const tableRelation = message.match(/relation "([^"]+)" does not exist/i);
  const columnRelation = message.match(/column "([^"]+)" of relation "([^"]+)" does not exist/i);
  if (tableRelation) {
    return { kind: "missing_table", table: tableRelation[1], message };
  }
  if (columnRelation) {
    return { kind: "missing_column", table: columnRelation[2], message };
  }
  if (/Unique constraint|already exists/i.test(message)) {
    return { kind: "unique_violation", message };
  }
  if (/ECONN|ETIMEDOUT|connection|too many clients/i.test(message)) {
    return { kind: "db_connection", message };
  }
  return { kind: "db_write_failed", message };
}

async function readRegisterPayload(req: NextRequest): Promise<
  | {
      ok: true;
      data: {
        firstName: FormDataEntryValue | null;
        lastName: FormDataEntryValue | null;
        email: FormDataEntryValue | null;
        password: FormDataEntryValue | null;
        passwordConfirm: FormDataEntryValue | null;
        language: FormDataEntryValue | null;
      };
    }
  | { ok: false }
> {
  // The form posts as application/x-www-form-urlencoded or multipart/form-data;
  // both are handled by req.formData(). A mistyped Content-Type (most often
  // application/json from a debugger or third-party client) makes formData()
  // throw, which we then translate into a user-facing "invalid" error rather
  // than the generic "server" message.
  try {
    const form = await req.formData();
    return {
      ok: true,
      data: {
        firstName: form.get("firstName"),
        lastName: form.get("lastName"),
        email: form.get("email"),
        password: form.get("password"),
        passwordConfirm: form.get("passwordConfirm"),
        language: form.get("language"),
      },
    };
  } catch {
    return { ok: false };
  }
}

export async function POST(req: NextRequest) {
  const requestId = req.headers.get(REQUEST_ID_HEADER) ?? undefined;
  try {
    // Pre-warm the account email schema before anything else. Idempotent
    // and cheap on a healthy database; on a database that's missing
    // User.emailVerifiedAt or the token tables this creates them so the
    // welcome-email step below can succeed without leaving the user with
    // no verification link. Errors here are logged but never block
    // registration — the catch in the welcome block will surface the
    // missing piece via structured logs.
    try {
      const ensure = await ensureAccountEmailTables();
      if (!ensure.ok) {
        logger.error("auth.register.ensure_email_tables_failed", {
          requestId,
          message: ensure.message,
        });
      } else if (ensure.created.length > 0) {
        logger.warn("auth.register.email_tables_auto_created", {
          requestId,
          created: ensure.created,
        });
      }
    } catch (e) {
      logger.error("auth.register.ensure_email_tables_threw", {
        requestId,
        message: e instanceof Error ? e.message : "unknown_error",
      });
    }

    const payload = await readRegisterPayload(req);
    if (!payload.ok) {
      logger.warn("auth.register.bad_body", { requestId });
      return redirectWithError(req, "invalid");
    }
    const parsed = registerSchema.safeParse({
      firstName: payload.data.firstName,
      lastName: payload.data.lastName,
      email: payload.data.email,
      password: payload.data.password,
      passwordConfirm: payload.data.passwordConfirm,
      language: typeof payload.data.language === "string" ? payload.data.language : undefined,
    });

    if (!parsed.success) {
      return redirectWithError(req, classifyError(parsed));
    }

    const ip = getClientIp(req);
    const limit = await rateLimit(`register:${ip}`, RATE_POLICIES.register, { ipAddress: ip });
    if (!limit.ok) return redirectWithError(req, "rate_limited");

    let existing;
    try {
      existing = await findUserByEmail(parsed.data.email);
    } catch (error) {
      const detail = describeWriteError(error);
      logApiError({
        method: "POST",
        route: "/api/auth/register",
        table: detail.table ?? "User",
        query: "findUserByEmail",
        error,
      });
      logger.error("auth.register.lookup_failed", {
        requestId,
        kind: detail.kind,
        table: detail.table,
        message: detail.message,
      });
      return redirectWithError(req, "server");
    }
    if (existing) return redirectWithError(req, "exists");

    const language = resolveLocaleFromRequest(req, parsed.data.language);

    let user;
    try {
      user = await createUser({ ...parsed.data, language });
    } catch (error) {
      const detail = describeWriteError(error);
      logApiError({
        method: "POST",
        route: "/api/auth/register",
        table: detail.table ?? "User",
        query: "createUser",
        error,
      });
      logger.error("auth.register.create_failed", {
        requestId,
        kind: detail.kind,
        table: detail.table,
        message: detail.message,
      });
      // Race with a concurrent signup is the most common write error here —
      // surface it as the user-facing "exists" case so the form gets a useful
      // message rather than a generic server error.
      if (detail.kind === "unique_violation") {
        return redirectWithError(req, "exists");
      }
      // missing_table / missing_column are operator-fixable (run migrations)
      // but the user can do nothing about them; show the generic server
      // error and let the structured log carry the diagnosis.
      return redirectWithError(req, "server");
    }

    // One onboarding email that welcomes the user AND carries the
    // email-verification link as its CTA — replaces the previous flow
    // that sent two near-duplicate messages back-to-back. Failures must
    // not block account creation, but they MUST be logged loudly enough
    // for the operator to see — silently returning success would leave
    // the user with no way to verify their email and no signal that
    // anything is wrong.
    try {
      const issued = await issueEmailVerificationToken(user.id);
      logger.info("auth.email_verification.requested", {
        userId: user.id,
        requestId,
        // Never log the raw token — only its expiration.
        expiresAt: issued.expiresAt.toISOString(),
      });
      const welcomeResult = await sendWelcomeEmail({
        user,
        token: issued.token,
        expiresAt: issued.expiresAt,
      });
      if (!welcomeResult.ok) {
        // Delivery_failed: Resend rejected the send. Surface the
        // structured error fields (name + message) so the operator
        // log line names the cause (sender domain unverified,
        // restricted API key, invalid recipient, …).
        logger.error("auth.welcome.delivery_failed", {
          userId: user.id,
          requestId,
          reason: welcomeResult.reason,
          errorName: welcomeResult.errorName,
          errorMessage: welcomeResult.errorMessage,
          statusCode: welcomeResult.statusCode,
        });
      } else if (welcomeResult.delivery === "skipped") {
        // RESEND_API_KEY not configured: log loudly so the operator
        // notices that new accounts are not getting verification
        // links. Account creation still succeeds.
        logger.error("auth.welcome.email_not_configured", {
          userId: user.id,
          requestId,
          reason: "RESEND_API_KEY missing",
        });
      } else {
        logger.info("auth.welcome.sent", {
          userId: user.id,
          requestId,
          delivery: welcomeResult.delivery,
        });
      }
    } catch (error) {
      // The token write itself threw — almost always a missing
      // EmailVerificationToken table or a missing column. Account is
      // still created; the user can request a fresh verification email
      // from /profile once the operator runs migrations.
      const detail = describeWriteError(error);
      logger.error("auth.welcome.token_creation_failed", {
        userId: user.id,
        requestId,
        kind: detail.kind,
        table: detail.table,
        message: detail.message,
      });
    }

    try {
      const session = await getSession();
      session.userId = user.id;
      session.userEmail = user.email;
      session.userName = `${user.firstName} ${user.lastName}`;
      session.role = "USER";
      session.locale = language;
      await session.save();
    } catch (error) {
      const detail = describeWriteError(error);
      logger.error("auth.register.session_failed", {
        userId: user.id,
        requestId,
        kind: detail.kind,
        table: detail.table ?? "Session",
        message: detail.message,
      });
      // Account exists but session couldn't be established — send the user
      // to the login page rather than blowing up the request.
      return redirectTo(req, "/login?registered=1");
    }

    // Persist the chosen locale to the cookie so the next page load uses it.
    cookies().set(LOCALE_COOKIE_NAME, language, LOCALE_COOKIE_OPTIONS);

    return redirectTo(req, "/profile");
  } catch (error) {
    logApiError({
      method: "POST",
      route: "/api/auth/register",
      error,
    });
    logger.error("auth.register.unhandled", {
      requestId,
      message: error instanceof Error ? error.message : "unknown_error",
    });
    return redirectWithError(req, "server");
  }
}
