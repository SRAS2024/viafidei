import { cookies } from "next/headers";

export const THEME_COOKIE_NAME = "vf_theme";

export type ThemePreference = "light" | "dark";

export function isThemePreference(input: string | null | undefined): input is ThemePreference {
  return input === "light" || input === "dark";
}

export async function getThemeCookieValue(): Promise<ThemePreference> {
  const raw = cookies().get(THEME_COOKIE_NAME)?.value ?? null;
  return isThemePreference(raw) ? raw : "light";
}
