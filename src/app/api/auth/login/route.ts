import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { authenticate, loginSchema, getSession } from "@/lib/auth";
import { rateLimit, RATE_POLICIES } from "@/lib/security/rate-limit";
import { getClientIp } from "@/lib/security/request";
import { isSupportedLocale } from "@/lib/i18n/locales";
import { LOCALE_COOKIE_NAME, LOCALE_COOKIE_OPTIONS } from "@/lib/i18n/cookie";

const LOGIN_INVALID = "/login?error=invalid";
const DEFAULT_NEXT = "/profile";

function safeNext(raw: string | null): string {
  return raw && raw.startsWith("/") ? raw : DEFAULT_NEXT;
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const parsed = loginSchema.safeParse({
    email: form.get("email"),
    password: form.get("password"),
  });
  const next = safeNext((form.get("next") as string | null) ?? null);

  if (!parsed.success) {
    return NextResponse.redirect(new URL(LOGIN_INVALID, req.url), 303);
  }

  const ip = getClientIp(req);
  const limit = await rateLimit(
    `login:${ip}:${parsed.data.email.toLowerCase()}`,
    RATE_POLICIES.login,
    { ipAddress: ip },
  );
  if (!limit.ok) {
    return NextResponse.redirect(new URL(LOGIN_INVALID, req.url), 303);
  }

  const user = await authenticate(parsed.data.email, parsed.data.password);
  if (!user) {
    return NextResponse.redirect(new URL(LOGIN_INVALID, req.url), 303);
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

  return NextResponse.redirect(new URL(next, req.url), 303);
}
