import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";

export type SessionData = {
  userId?: string;
  userEmail?: string;
  userName?: string;
  role?: "USER" | "ADMIN";
  adminSignedInAt?: number;
  locale?: string;
};

const password =
  process.env.SESSION_SECRET ||
  process.env.JWT_ACCESS_SECRET ||
  "via-fidei-dev-session-secret-please-rotate-at-least-32-chars";

export const sessionOptions: SessionOptions = {
  password,
  cookieName: "vf_session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  },
};

export async function getSession() {
  return getIronSession<SessionData>(cookies(), sessionOptions);
}
