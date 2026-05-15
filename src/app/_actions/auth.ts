"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { LOCALE_COOKIE_NAME } from "@/lib/i18n/cookie";
import { RITE_COOKIE_NAME } from "@/lib/i18n/rite-cookie";
import { THEME_COOKIE_NAME } from "@/lib/i18n/theme-cookie";

/**
 * Cookies that hold the signed-in user's UI preferences (theme, rite,
 * locale). They live on the browser, not in the session, so without
 * explicit cleanup they would persist after sign-out — meaning the
 * next visitor in the same browser inherits the previous user's
 * dark mode / Catholic rite / language. That's the symptom the
 * operator reported. Clearing all three on sign-out resets the
 * browser to a clean default for whoever logs in next (or for the
 * anonymous post-logout view).
 */
async function clearUserPreferenceCookies(): Promise<void> {
  const c = await cookies();
  c.delete(THEME_COOKIE_NAME);
  c.delete(RITE_COOKIE_NAME);
  c.delete(LOCALE_COOKIE_NAME);
}

/**
 * Sign-out as a Server Action.
 *
 * Why an action instead of a route handler: a plain POST form to
 * /api/auth/logout returns a 303, which the browser follows with a fresh
 * GET — but the Next.js client Router Cache holds the previously rendered
 * RSC payload for the layout (which contains the Header), so the visible
 * "signed in" Header lingers until the user hard-refreshes. A Server
 * Action paired with `redirect()` from `next/navigation` invalidates the
 * router cache as part of the action contract, so the redirected page
 * renders against an empty session immediately and the Header flips to
 * "signed out" without a manual refresh. `revalidatePath("/", "layout")`
 * also clears any cached layout segments so deep links rendered after the
 * sign-out reflect the new state.
 *
 * Also clears the per-browser preference cookies (theme / rite / locale)
 * so the next visitor in the same browser starts on the app's defaults
 * instead of inheriting the previous account's choices.
 *
 * The /api/auth/logout route handler is kept for tests and for any
 * non-form caller that still posts there.
 */
export async function logoutAction() {
  const session = await getSession();
  session.destroy();
  await clearUserPreferenceCookies();
  revalidatePath("/", "layout");
  redirect("/");
}

/**
 * Admin sign-out as a Server Action. Same router-cache rationale as the
 * user-side `logoutAction`. Also writes an audit row so the operator can
 * see who signed out and when.
 */
export async function adminLogoutAction() {
  const session = await getSession();
  const username = session.userEmail;
  session.destroy();
  if (username) {
    await writeAudit({
      action: "admin.logout",
      entityType: "Session",
      entityId: "admin",
      actorUsername: username,
    });
  }
  await clearUserPreferenceCookies();
  revalidatePath("/", "layout");
  redirect("/admin/login");
}
