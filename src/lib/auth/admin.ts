import { constantTimeEquals } from "../security/hash";
import { verifyAdminPassword } from "./password";
import { logger } from "../observability/logger";
import { getSession } from "./session";
import {
  resolveAdminSession,
  revokeAdminSession,
  type AdminSessionDenyReason,
} from "./admin-session";

export type AdminPrincipal = {
  username: string;
  signedInAt: number;
  /** Opaque id of the server-side session backing this principal. */
  adminSessionId?: string;
  /** When the second factor was verified, in ms. */
  twoFactorVerifiedAt?: number;
};

/**
 * Why an admin authorization check denied. Every value is a DENY — the type
 * exists so callers can record WHICH control fired instead of collapsing
 * everything into "not signed in".
 */
export type AdminDenyReason =
  | "no_admin_session"
  | "no_server_session"
  | "pending_two_factor"
  | "revoked"
  | "expired_absolute"
  | "expired_idle"
  | "indeterminate";

export type AdminAuthOutcome =
  | { ok: true; admin: AdminPrincipal }
  | { ok: false; reason: AdminDenyReason };

export async function verifyAdminCredentials(username: string, password: string): Promise<boolean> {
  const expectedUser = process.env.ADMIN_USERNAME;
  const expectedPass = process.env.ADMIN_PASSWORD;
  // Missing credential configuration disables admin sign-in entirely rather
  // than accepting anything — fail closed.
  if (!expectedUser || !expectedPass) return false;
  // Both checks run before they are combined so a wrong username and a wrong
  // password cost the same. The password goes through Argon2id rather than a
  // plaintext comparison — see verifyAdminPassword.
  const userOk = constantTimeEquals(username, expectedUser);
  const passOk = await verifyAdminPassword(expectedPass, password);
  return userOk && passOk;
}

const SESSION_REASONS: Record<AdminSessionDenyReason, AdminDenyReason> = {
  no_server_session: "no_server_session",
  pending_two_factor: "pending_two_factor",
  revoked: "revoked",
  expired_absolute: "expired_absolute",
  expired_idle: "expired_idle",
  indeterminate: "indeterminate",
};

/**
 * Next.js control-flow exceptions, which must never be caught by an
 * authorization guard. They carry a `digest` tag rather than a distinct
 * class, and the framework relies on them propagating out of the render.
 */
const FRAMEWORK_DIGESTS = new Set([
  "DYNAMIC_SERVER_USAGE",
  "BAILOUT_TO_CLIENT_SIDE_RENDERING",
  "NEXT_REDIRECT",
  "NEXT_NOT_FOUND",
]);

function isFrameworkControlFlow(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const digest = (error as { digest?: unknown }).digest;
  if (typeof digest !== "string") return false;
  // NEXT_REDIRECT carries its destination after a ";" separator.
  return FRAMEWORK_DIGESTS.has(digest) || FRAMEWORK_DIGESTS.has(digest.split(";")[0] ?? "");
}

/**
 * Resolve the current request to an administrator, with the reason when it
 * does not.
 *
 * A cookie that says `role: "ADMIN"` is NOT sufficient and never has been the
 * whole story here: authority comes from the server-side `AdminSession` row,
 * which exists only after BOTH stages of the sign-in completed (password, then
 * second factor), is unrevoked, and sits inside both its idle and absolute
 * windows. A password-verified PENDING session fails this check by design.
 *
 * Fails closed: any error — an unreadable cookie, an unreachable session
 * store — denies and is recorded through the existing diagnostics. That means
 * a database outage locks the human administrator out; it does not affect
 * ordinary users, and the Admin Worker does not call this at all.
 */
export async function resolveAdminPrincipal(): Promise<AdminAuthOutcome> {
  let session: Awaited<ReturnType<typeof getSession>>;
  try {
    session = await getSession();
  } catch (error) {
    // Next signals "this route must render dynamically" (and redirect /
    // notFound) by THROWING a tagged error out of cookies(). Swallowing those
    // would tell the framework the page rendered fine while it silently
    // decided the visitor is not an admin — during `next build` that risks
    // baking a denied admin page into static output. Re-throw them; they are
    // control flow, not an authentication failure.
    if (isFrameworkControlFlow(error)) throw error;
    // An undecryptable / malformed session cookie is not an admin.
    logger.warn("admin.auth.session_unreadable", {
      error: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, reason: "indeterminate" };
  }

  const sessionId = session.adminSessionId;
  if (!sessionId) {
    // No server-side session id at all. If the cookie nonetheless claims the
    // ADMIN role it is a legacy or forged cookie — say so, and still deny.
    return {
      ok: false,
      reason: session.role === "ADMIN" ? "no_server_session" : "no_admin_session",
    };
  }
  // The cookie's own view must already agree that both stages completed.
  // The store is authoritative, but a cookie still marked PENDING is refused
  // without a query.
  if (session.role !== "ADMIN" || session.adminAuthStage !== "AUTHENTICATED") {
    return { ok: false, reason: "pending_two_factor" };
  }

  const resolved = await resolveAdminSession(sessionId);
  if (!resolved.valid) {
    return { ok: false, reason: SESSION_REASONS[resolved.reason] };
  }

  const { record } = resolved;
  // The authentication state behind the session can go invalid without the
  // session itself changing: rotate ADMIN_USERNAME and every session minted
  // for the previous identity must die, not keep acting as that admin. Revoke
  // it server-side so the next request cannot re-litigate the same question.
  const configuredUsername = process.env.ADMIN_USERNAME;
  if (
    configuredUsername &&
    record.adminUsername &&
    !constantTimeEquals(record.adminUsername, configuredUsername)
  ) {
    void revokeAdminSession(sessionId, "admin_identity_changed");
    return { ok: false, reason: "revoked" };
  }

  return {
    ok: true,
    admin: {
      username: record.adminUsername || session.userEmail || process.env.ADMIN_USERNAME || "admin",
      signedInAt: record.authenticatedAt.getTime(),
      adminSessionId: sessionId,
      twoFactorVerifiedAt: record.twoFactorVerifiedAt?.getTime(),
    },
  };
}

/**
 * The single admin authorization check used by every admin page and API
 * route. Returns the principal, or null when the request is not a fully
 * authenticated (password + second factor) administrator.
 *
 * Never throws — a thrown guard is a guard that callers forget to handle, and
 * `catch`-less callers would then serve admin pages on an error boundary.
 */
export async function requireAdmin(): Promise<AdminPrincipal | null> {
  const outcome = await resolveAdminPrincipal();
  return outcome.ok ? outcome.admin : null;
}
