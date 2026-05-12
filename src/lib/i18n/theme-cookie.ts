import { cookies } from "next/headers";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

export const THEME_COOKIE_NAME = "vf_theme";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/**
 * Cookie options used when the server writes the theme cookie (on login
 * restore, on profile update). The client-side picker uses a matching
 * options shape via document.cookie. Path "/" so the cookie is sent on
 * every route; SameSite "lax" so it survives normal navigation but is
 * not sent on cross-site POSTs.
 */
export const THEME_COOKIE_OPTIONS = {
  path: "/",
  maxAge: ONE_YEAR_SECONDS,
  sameSite: "lax" as const,
};

export type ThemePreference = "light" | "dark";

export function isThemePreference(input: string | null | undefined): input is ThemePreference {
  return input === "light" || input === "dark";
}

export async function getThemeCookieValue(): Promise<ThemePreference> {
  const raw = cookies().get(THEME_COOKIE_NAME)?.value ?? null;
  if (isThemePreference(raw)) return raw;
  // Cookie missing or malformed — if the visitor is signed in, fall back
  // to whatever theme they saved on their profile so a stripped cookie
  // (logout-cleared, ad-blocker, third-party-cookie policy) doesn't drop
  // them back to light mode against their stored preference.
  try {
    const session = await getSession();
    if (session?.userId) {
      const profile = await prisma.profile.findUnique({
        where: { userId: session.userId },
        select: { theme: true },
      });
      if (profile && isThemePreference(profile.theme)) return profile.theme;
    }
  } catch {
    // No session / DB hiccup — fall through to the anonymous default.
  }
  return "light";
}
