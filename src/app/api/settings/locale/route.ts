import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { LOCALE_COOKIE_NAME } from "@/lib/i18n/server";
import { isSupportedLocale } from "@/lib/i18n/locales";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const raw = String(form.get("locale") ?? "");
  const c = cookies();
  if (raw && isSupportedLocale(raw)) {
    c.set(LOCALE_COOKIE_NAME, raw, {
      path: "/",
      httpOnly: false,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
    });
  } else {
    c.delete(LOCALE_COOKIE_NAME);
  }
  return NextResponse.redirect(new URL("/profile/settings", req.url), 303);
}
