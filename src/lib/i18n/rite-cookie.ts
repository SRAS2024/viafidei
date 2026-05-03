import { cookies } from "next/headers";
import { isCatholicRite, type CatholicRite, DEFAULT_RITE } from "../content/rites";

export const RITE_COOKIE_NAME = "vf_rite";

export const RITE_COOKIE_OPTIONS = {
  path: "/",
  httpOnly: false,
  sameSite: "lax" as const,
  maxAge: 60 * 60 * 24 * 365,
};

export async function getRiteCookieValue(): Promise<CatholicRite> {
  const raw = cookies().get(RITE_COOKIE_NAME)?.value ?? null;
  return isCatholicRite(raw) ? raw : DEFAULT_RITE;
}
