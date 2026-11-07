import { type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { authenticate, loginSchema, getSession } from "@/lib/auth";
import { clearKeptFields, keepFormFields } from "@/lib/auth/form-flash";
import { safeNextPath } from "@/lib/auth/safe-next";
import { recordUserSignIn } from "@/lib/auth/session";
import { rateLimit, RATE_POLICIES } from "@/lib/security/rate-limit";
import { getClientIp, getUserAgent, redirectTo } from "@/lib/security/request";
import { reportSecurityBreach, reportSuspiciousActivity } from "@/lib/security/security-events";
import {
  recordUserPasswordFailure,
  resetUserPasswordFailureCounter,
} from "@/lib/security/user-failure-counter";
import { DEVICE_CREDENTIAL_COOKIE } from "@/middleware";
import { isSupportedLocale } from "@/lib/i18n/locales";
import { LOCALE_COOKIE_NAME, LOCALE_COOKIE_OPTIONS } from "@/lib/i18n/cookie";
import {
  THEME_COOKIE_NAME,
  THEME_COOKIE_OPTIONS,
  isThemePreference,
} from "@/lib/i18n/theme-cookie";
import { getProfileForUser } from "@/lib/data/profile";
import { logger, REQUEST_ID_HEADER } from "@/lib/observability";

// Argon2id password verification requires the Node runtime (native binding
// loaded by node-gyp-build). Pinning the runtime explicitly stops a future
// edit from accidentally migrating this route to the edge runtime, which
// would crash on first request.
export const runtime = "nodejs";

const LOGIN_INVALID = "/login?error=invalid";
const DEFAULT_NEXT = "/profile";

async function readLoginForm(req: NextRequest): Promise<FormData | null> {
  // formData() throws on a mistyped Content-Type (e.g. application/json).
  // Returning null here lets the caller respond with the same generic
  // "invalid" redirect rather than crashing into the global catch.
  try {
    return await req.formData();
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const requestId = req.headers.get(REQUEST_ID_HEADER) ?? undefined;
  let next: string | null = null;
  let typedEmail: FormDataEntryValue | null = null;
  // Every failure goes back to the form with the page the reader was on their way to
  // and the address they typed, so that one wrong password costs one password.
  const failed = async () => {
    await keepFormFields("/login", { email: typedEmail });
    return redirectTo(
      req,
      next ? `${LOGIN_INVALID}&next=${encodeURIComponent(next)}` : LOGIN_INVALID,
    );
  };
  try {
    const form = await readLoginForm(req);
    if (!form) {
      logger.warn("auth.login.bad_body", { requestId });
      return redirectTo(req, LOGIN_INVALID);
    }
    typedEmail = form.get("email");
    next = safeNextPath(form.get("next"));
    const parsed = loginSchema.safeParse({
      email: form.get("email"),
      password: form.get("password"),
    });

    if (!parsed.success) {
      return await failed();
    }

    const ip = getClientIp(req);
    const userAgent = getUserAgent(req);
    const deviceCredential = req.cookies.get(DEVICE_CREDENTIAL_COOKIE)?.value ?? null;
    const limit = await rateLimit(
      `login:${ip}:${parsed.data.email.toLowerCase()}`,
      RATE_POLICIES.login,
      { ipAddress: ip },
    );
    if (!limit.ok) {
      return await failed();
    }

    const user = await authenticate(parsed.data.email, parsed.data.password);
    if (!user) {
      // Track consecutive failures by email + IP + device credential.
      // > 5 -> Suspicious Activity; > 20 -> Security Breach (brute force).
      const failure = recordUserPasswordFailure({
        email: parsed.data.email,
        ipAddress: ip,
        deviceCredential,
      });
      if (failure.classification === "breach") {
        void reportSecurityBreach({
          kind: "user_password_brute_force",
          summary: `${failure.count} consecutive user-account login failures within ${Math.round(failure.windowMs / 60000)} minutes from ${ip ?? "unknown"} — brute-force pattern against ${parsed.data.email}.`,
          ipAddress: ip ?? undefined,
          userAgent: userAgent ?? undefined,
          route: "/api/auth/login",
          deviceCredential: deviceCredential ?? undefined,
          attemptedAction: "user_password_brute_force",
        });
      } else if (failure.classification === "suspicious") {
        void reportSuspiciousActivity({
          kind: "user_password_failed_repeatedly",
          summary: `${failure.count} consecutive login failures for ${parsed.data.email} from ${ip ?? "unknown"}.`,
          ipAddress: ip ?? undefined,
          userAgent: userAgent ?? undefined,
          route: "/api/auth/login",
          deviceCredential: deviceCredential ?? undefined,
          attemptedAccountOrRoute: parsed.data.email,
          recommendedAction:
            "Verify whether the legitimate account holder is signing in; if not, treat as suspected credential stuffing.",
        });
      }
      return await failed();
    }

    // Reset the consecutive-failure counter on a successful login.
    resetUserPasswordFailureCounter({
      email: parsed.data.email,
      ipAddress: ip,
      deviceCredential,
    });

    const session = await getSession();
    recordUserSignIn(session, user);
    if (user.language && isSupportedLocale(user.language)) {
      session.locale = user.language;
    }
    await session.save();

    // The signed-in user's saved language overrides any device-language guess.
    const cookieStore = await cookies();
    if (user.language && isSupportedLocale(user.language)) {
      cookieStore.set(LOCALE_COOKIE_NAME, user.language, LOCALE_COOKIE_OPTIONS);
    }

    // Restore the signed-in user's saved theme to the browser cookie so the
    // very next render (the post-login redirect) reflects their preference.
    // Sign-out clears this cookie so the next anonymous visitor doesn't
    // inherit the previous account's mode — without this restore step, the
    // returning user would always come back in light mode regardless of
    // what they had saved on their profile.
    const profile = await getProfileForUser(user.id).catch(() => null);
    if (profile && isThemePreference(profile.theme)) {
      cookieStore.set(THEME_COOKIE_NAME, profile.theme, THEME_COOKIE_OPTIONS);
    }

    await clearKeptFields("/login");
    return redirectTo(req, next ?? DEFAULT_NEXT);
  } catch (error) {
    logger.error("auth.login.unhandled", {
      requestId,
      message: error instanceof Error ? error.message : "unknown_error",
    });
    return failed();
  }
}
