import { type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { authenticate, loginSchema, getSession } from "@/lib/auth";
import { rateLimit, RATE_POLICIES } from "@/lib/security/rate-limit";
import { getClientIp, redirectTo } from "@/lib/security/request";
import { isSupportedLocale } from "@/lib/i18n/locales";
import { LOCALE_COOKIE_NAME, LOCALE_COOKIE_OPTIONS } from "@/lib/i18n/cookie";
import {
  THEME_COOKIE_NAME,
  THEME_COOKIE_OPTIONS,
  isThemePreference,
} from "@/lib/i18n/theme-cookie";
import { getProfileForUser } from "@/lib/data/profile";
import { logger, REQUEST_ID_HEADER } from "@/lib/observability";

const LOGIN_INVALID = "/login?error=invalid";
const DEFAULT_NEXT = "/profile";

function safeNext(raw: string | null): string {
  return raw && raw.startsWith("/") ? raw : DEFAULT_NEXT;
}

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
  try {
    const form = await readLoginForm(req);
    if (!form) {
      logger.warn("auth.login.bad_body", { requestId });
      return redirectTo(req, LOGIN_INVALID);
    }
    const parsed = loginSchema.safeParse({
      email: form.get("email"),
      password: form.get("password"),
    });
    const next = safeNext((form.get("next") as string | null) ?? null);

    if (!parsed.success) {
      return redirectTo(req, LOGIN_INVALID);
    }

    const ip = getClientIp(req);
    const limit = await rateLimit(
      `login:${ip}:${parsed.data.email.toLowerCase()}`,
      RATE_POLICIES.login,
      { ipAddress: ip },
    );
    if (!limit.ok) {
      return redirectTo(req, LOGIN_INVALID);
    }

    const user = await authenticate(parsed.data.email, parsed.data.password);
    if (!user) {
      return redirectTo(req, LOGIN_INVALID);
    }

    const session = await getSession();
    session.userId = user.id;
    session.userEmail = user.email;
    session.userName = `${user.firstName} ${user.lastName}`;
    session.role = "USER";
    if (user.language && isSupportedLocale(user.language)) {
      session.locale = user.language;
    }
    await session.save();

    // The signed-in user's saved language overrides any device-language guess.
    if (user.language && isSupportedLocale(user.language)) {
      cookies().set(LOCALE_COOKIE_NAME, user.language, LOCALE_COOKIE_OPTIONS);
    }

    // Restore the signed-in user's saved theme to the browser cookie so the
    // very next render (the post-login redirect) reflects their preference.
    // Sign-out clears this cookie so the next anonymous visitor doesn't
    // inherit the previous account's mode — without this restore step, the
    // returning user would always come back in light mode regardless of
    // what they had saved on their profile.
    const profile = await getProfileForUser(user.id).catch(() => null);
    if (profile && isThemePreference(profile.theme)) {
      cookies().set(THEME_COOKIE_NAME, profile.theme, THEME_COOKIE_OPTIONS);
    }

    return redirectTo(req, next);
  } catch (error) {
    logger.error("auth.login.unhandled", {
      requestId,
      message: error instanceof Error ? error.message : "unknown_error",
    });
    return redirectTo(req, LOGIN_INVALID);
  }
}
