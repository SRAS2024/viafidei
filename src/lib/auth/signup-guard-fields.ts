/**
 * The sign-up form's bot guards, as far as the browser needs to know them. Kept apart from
 * ./signup-guard, which signs with node:crypto and so cannot reach a client component.
 */

/** The hidden field that carries the signed moment the form was handed out. */
export const SIGNUP_FORM_TOKEN_FIELD = "formToken";

/**
 * The field only a machine fills in. A machine that fills in every box it finds fills this
 * one too; a person never meets it (see RegisterForm). Its name is a box such machines like
 * to fill, and no browser or password manager maps it to anything they store.
 */
export const SIGNUP_FORM_TRAP_FIELD = "website";

/**
 * Nobody can fill in five fields and press the button within three seconds of the page
 * arriving, even with every field filled for them. The two bots that signed strangers up in
 * 2026 posted the form between 0.2 and 0.9 seconds after fetching it.
 */
export const SIGNUP_FORM_MIN_FILL_MS = 3_000;
