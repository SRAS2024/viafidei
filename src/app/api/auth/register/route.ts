import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import {
  createUser,
  registerSchema,
  findUserByEmail,
  getSession,
  issueEmailVerificationToken,
} from "@/lib/auth";
import { rateLimit, RATE_POLICIES } from "@/lib/security/rate-limit";
import { getClientIp } from "@/lib/security/request";
import { sendEmailVerificationEmail, sendWelcomeEmail } from "@/lib/email";
import { logger, REQUEST_ID_HEADER } from "@/lib/observability";
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

function redirectWithError(req: NextRequest, code: string): NextResponse {
  return NextResponse.redirect(new URL(`/register?error=${code}`, req.url), 303);
}

export async function POST(req: NextRequest) {
  const requestId = req.headers.get(REQUEST_ID_HEADER) ?? undefined;
  try {
    const form = await req.formData();
    const parsed = registerSchema.safeParse({
      firstName: form.get("firstName"),
      lastName: form.get("lastName"),
      email: form.get("email"),
      password: form.get("password"),
      passwordConfirm: form.get("passwordConfirm"),
      language:
        typeof form.get("language") === "string" ? (form.get("language") as string) : undefined,
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
      logger.error("auth.register.lookup_failed", {
        requestId,
        message: error instanceof Error ? error.message : "unknown_error",
      });
      return redirectWithError(req, "server");
    }
    if (existing) return redirectWithError(req, "exists");

    const language = resolveLocaleFromRequest(req, parsed.data.language);

    let user;
    try {
      user = await createUser({ ...parsed.data, language });
    } catch (error) {
      logger.error("auth.register.create_failed", {
        requestId,
        message: error instanceof Error ? error.message : "unknown_error",
      });
      // The most common race-condition: a duplicate email slipped past the
      // pre-check. Treat both as the user-facing "exists" case so the form
      // surfaces a useful message rather than a generic server error.
      const msg = error instanceof Error ? error.message : "";
      if (/Unique constraint|already exists|email/i.test(msg)) {
        return redirectWithError(req, "exists");
      }
      return redirectWithError(req, "server");
    }

    // Welcome email — fire-and-log; failures must not block account creation.
    try {
      const welcomeResult = await sendWelcomeEmail(user);
      logger.info("auth.welcome.sent", {
        userId: user.id,
        requestId,
        delivery: welcomeResult.ok ? welcomeResult.delivery : "failed",
      });
    } catch (error) {
      logger.error("auth.welcome.send_failed", {
        userId: user.id,
        requestId,
        message: error instanceof Error ? error.message : "unknown_error",
      });
    }

    // Email verification token + email.
    try {
      const issued = await issueEmailVerificationToken(user.id);
      logger.info("auth.email_verification.requested", {
        userId: user.id,
        requestId,
        // Never log the raw token — only its expiration.
        expiresAt: issued.expiresAt.toISOString(),
      });
      await sendEmailVerificationEmail({
        user,
        token: issued.token,
        expiresAt: issued.expiresAt,
      });
    } catch (error) {
      logger.error("auth.email_verification.issue_failed", {
        userId: user.id,
        requestId,
        message: error instanceof Error ? error.message : "unknown_error",
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
      logger.error("auth.register.session_failed", {
        userId: user.id,
        requestId,
        message: error instanceof Error ? error.message : "unknown_error",
      });
      // Account exists but session couldn't be established — send the user
      // to the login page rather than blowing up the request.
      return NextResponse.redirect(new URL("/login?registered=1", req.url), 303);
    }

    // Persist the chosen locale to the cookie so the next page load uses it.
    cookies().set(LOCALE_COOKIE_NAME, language, LOCALE_COOKIE_OPTIONS);

    return NextResponse.redirect(new URL("/profile", req.url), 303);
  } catch (error) {
    logger.error("auth.register.unhandled", {
      requestId,
      message: error instanceof Error ? error.message : "unknown_error",
    });
    return redirectWithError(req, "server");
  }
}
