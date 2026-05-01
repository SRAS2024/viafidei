export const LOCALE_COOKIE_NAME = "vf_locale";

export const LOCALE_COOKIE_OPTIONS = {
  path: "/",
  httpOnly: false,
  sameSite: "lax" as const,
  maxAge: 60 * 60 * 24 * 365,
};
