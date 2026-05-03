import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { isCatholicRite } from "@/lib/content/rites";
import { RITE_COOKIE_NAME, RITE_COOKIE_OPTIONS } from "@/lib/i18n/rite-cookie";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const raw = String(form.get("rite") ?? "");
  const c = cookies();
  if (raw && isCatholicRite(raw)) {
    c.set(RITE_COOKIE_NAME, raw, RITE_COOKIE_OPTIONS);
  } else {
    c.delete(RITE_COOKIE_NAME);
  }
  const next = String(form.get("next") ?? "/profile/settings");
  return NextResponse.redirect(new URL(next, req.url), 303);
}
