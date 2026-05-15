import { type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getSession } from "@/lib/auth";
import { redirectTo } from "@/lib/security/request";
import { LOCALE_COOKIE_NAME } from "@/lib/i18n/cookie";
import { RITE_COOKIE_NAME } from "@/lib/i18n/rite-cookie";
import { THEME_COOKIE_NAME } from "@/lib/i18n/theme-cookie";

// iron-session uses node:crypto under the hood; pin Node runtime.
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const session = await getSession();
  session.destroy();
  // Clear the per-browser preference cookies so the next visitor in
  // this browser starts on the app's defaults instead of inheriting
  // the previous user's theme / rite / language. Same rationale as
  // logoutAction — see src/app/_actions/auth.ts.
  const c = await cookies();
  c.delete(THEME_COOKIE_NAME);
  c.delete(RITE_COOKIE_NAME);
  c.delete(LOCALE_COOKIE_NAME);
  return redirectTo(req, "/");
}
