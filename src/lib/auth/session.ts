import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";
import { DEV_FALLBACK_SECRET } from "../security/keys";

export type UserRole = "USER" | "ADMIN";

export type SessionData = {
  userId?: string;
  userEmail?: string;
  userName?: string;
  role?: UserRole;
  adminSignedInAt?: number;
  locale?: string;
};

const password =
  process.env.SESSION_SECRET ||
  process.env.JWT_ACCESS_SECRET ||
  `${DEV_FALLBACK_SECRET}-session`;

export const SESSION_COOKIE_NAME = "vf_session";

export const sessionOptions: SessionOptions = {
  password,
  cookieName: SESSION_COOKIE_NAME,
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
