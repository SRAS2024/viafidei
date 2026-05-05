import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";

// Inlined to keep this module edge-runtime safe — `middleware.ts` imports
// SESSION_COOKIE_NAME from here, and pulling in anything that touches
// `node:crypto` would break the middleware bundle.
const DEV_FALLBACK_SECRET = "via-fidei-dev-secret-change-me-please-32b";

export type UserRole = "USER" | "ADMIN";

export type SessionData = {
  userId?: string;
  userEmail?: string;
  userName?: string;
  role?: UserRole;
  adminSignedInAt?: number;
  locale?: string;
};

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
  return getIronSession<SessionData>(cookies(), sessionOptions);
}
