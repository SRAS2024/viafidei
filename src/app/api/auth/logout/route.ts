import { type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getSession } from "@/lib/auth";
import { revokeCurrentAdminSession } from "@/lib/auth/admin-session";
import { redirectTo } from "@/lib/security/request";
import { LOCALE_COOKIE_NAME } from "@/lib/i18n/cookie";
import { RITE_COOKIE_NAME } from "@/lib/i18n/rite-cookie";
import { THEME_COOKIE_NAME } from "@/lib/i18n/theme-cookie";

// iron-session uses node:crypto under the hood; pin Node runtime.
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  // Sign-out must invalidate SERVER-side state, not just the cookie. If the
  // browser copy is merely deleted, any earlier copy of the same encrypted
  // cookie keeps working until it expires. Revoking the AdminSession row
  // first means the session is dead the instant this returns — revoked rows
  // stop passing requireAdmin() and the admin trust rule. No-op for ordinary
  // users, who carry no admin session id.
  await revokeCurrentAdminSession("logout");

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
