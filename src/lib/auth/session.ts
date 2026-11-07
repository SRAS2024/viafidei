import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";

// Inlined to keep this module edge-runtime safe — `middleware.ts` imports
// SESSION_COOKIE_NAME from here, and pulling in anything that touches
// `node:crypto` would break the middleware bundle.
const DEV_FALLBACK_SECRET = "via-fidei-dev-secret-change-me-please-32b";

export type UserRole = "USER" | "ADMIN";

/**
 * How far through the two-stage admin sign-in this cookie is.
 *
 *   PENDING       — the admin password was accepted; the second factor is
 *                   still outstanding. Carries NO authority: requireAdmin(),
 *                   evaluateAdminTrust() and gateAdminApiCall() all deny it.
 *   AUTHENTICATED — password AND second factor both completed.
 *
 * The cookie is only ever a mirror. The authoritative record is the
 * `AdminSession` row addressed by `adminSessionId` (see
 * `src/lib/auth/admin-session.ts`) — it is what expires, what revokes, and
 * what a stolen cookie cannot forge.
 *
 * Applies to a human administrator at the interactive admin interface only.
 * Ordinary user accounts and every automated process (the Admin Worker
 * included) never carry these fields.
 */
export type AdminAuthStage = "PENDING" | "AUTHENTICATED";

export type SessionData = {
  userId?: string;
  userEmail?: string;
  userName?: string;
  role?: UserRole;
  adminSignedInAt?: number;
  /**
   * Opaque id of the server-side admin session. Only ever stored inside this
   * encrypted cookie — the database holds an HMAC of it, never the raw value.
   */
  adminSessionId?: string;
  adminAuthStage?: AdminAuthStage;
  locale?: string;
  /**
   * The account's credential version when this cookie was issued. A password reset
   * changes the account's version, and a cookie carrying any other value stops
   * counting as signed in (see `sessionCredentialsCurrent` in ./user.ts). The cookie is
   * sealed, so a browser cannot rewrite it.
   */
  credentialVersion?: string;
};

/** What a successful sign-in writes into a reader's session cookie. */
export function recordUserSignIn(
  session: SessionData,
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    credentialVersion?: string | null;
  },
): void {
  session.userId = user.id;
  session.userEmail = user.email;
  session.userName = `${user.firstName} ${user.lastName}`;
  session.role = "USER";
  session.credentialVersion = user.credentialVersion ?? undefined;
}

function isBuildPhase(): boolean {
  return process.env.NEXT_PHASE === "phase-production-build";
}

function resolveSessionPassword(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === "production" && !isBuildPhase()) {
    throw new Error("SESSION_SECRET must be set to a 32+ character value in production.");
  }
  return `${DEV_FALLBACK_SECRET}-session`;
}

export const SESSION_COOKIE_NAME = "vf_session";

export const sessionOptions: SessionOptions = {
  // iron-session reads `password` lazily on each call; using a getter defers
  // the production guard until an actual request is served, so static build
  // analysis (which sets NODE_ENV=production without secrets) doesn't fail.
  get password() {
    return resolveSessionPassword();
  },
  cookieName: SESSION_COOKIE_NAME,
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  },
} as SessionOptions;

export async function getSession() {
  // Next 15 made cookies() async — await before handing the store to
  // iron-session, which expects the resolved CookieStore.
  return getIronSession<SessionData>(await cookies(), sessionOptions);
}
