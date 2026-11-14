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

/** The hidden field the page's own script fills in once it has run (see signupFormProof). */
export const SIGNUP_FORM_PROOF_FIELD = "formProof";

function fnv1a(text: string, seed: number): string {
  let hash = seed >>> 0;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

/**
 * What the page's script writes into the form, worked out from the form's note. It is not
 * in the page as sent, so a post carries it only if the page's script ran, as it does in
 * every browser, with or without a screen reader. Neither 2026 bot ever loaded the page's
 * scripts. Not a secret, and no match for a bot that drives a real browser.
 */
export function signupFormProof(token: string): string {
  const text = `via-fidei/signup-proof/${token}`;
  return fnv1a(text, 0x811c9dc5) + fnv1a(text, 0x050c5d1f);
}
