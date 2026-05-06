"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";

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
 * The /api/auth/logout route handler is kept for tests and for any
 * non-form caller that still posts there.
 */
export async function logoutAction() {
  const session = await getSession();
  session.destroy();
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
  revalidatePath("/", "layout");
  redirect("/admin/login");
}
