import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { isSupportedLocale } from "@/lib/i18n/locales";
import { LOCALE_COOKIE_NAME, LOCALE_COOKIE_OPTIONS } from "@/lib/i18n/cookie";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const raw = String(form.get("locale") ?? "");
  const c = cookies();
  if (raw && isSupportedLocale(raw)) {
    c.set(LOCALE_COOKIE_NAME, raw, LOCALE_COOKIE_OPTIONS);
  } else {
    c.delete(LOCALE_COOKIE_NAME);
  }
  return NextResponse.redirect(new URL("/profile/settings", req.url), 303);
}
