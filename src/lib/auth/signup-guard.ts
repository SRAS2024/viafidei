import crypto from "node:crypto";
import { getPurposeKey } from "@/lib/security/keys";
import { rateLimit, RATE_POLICIES } from "@/lib/security/rate-limit";
import { SIGNUP_FORM_MIN_FILL_MS } from "./signup-guard-fields";

/**
 * Guards on the sign-up form that a person never meets.
 *
 * From September 2026 two bots used the form to sign strangers' real addresses up, so each
 * stranger got a welcome email from Via Fidei they never asked for: one named every account
 * "Test User" (about 90 a day), the other used common names. Railway's request logs showed
 * how they worked: each fetched /register, filled the fields in and posted them 0.2 to 0.9
 * seconds later, without ever loading the page's scripts or styles.
 *
 * So the form is handed out with a signed note of the moment it was made (a token in a
 * hidden field), and a post is refused when:
 *
 *   - the field only a machine can reach was filled in (see SIGNUP_FORM_TRAP_FIELD);
 *   - the note is missing, damaged or not signed by this server;
 *   - it came back sooner than SIGNUP_FORM_MIN_FILL_MS after the page was made, which no
 *     person manages (and the page itself holds back a quicker press, see RegisterForm);
 *   - it is older than SIGNUP_FORM_MAX_AGE_MS, or has already made an account.
 *
 * Every refusal sends the reader back to the form with their names and address kept, asking
 * only for the password again, so even a person caught by one (say, a page left open for a
 * day) loses one step. Beyond these, each connection may make a few accounts a day and the
 * whole site a few dozen (RATE_POLICIES.registerDaily and registerSiteDaily), which bounds
 * the welcome emails a cleverer bot could cause.
 */

export const SIGNUP_FORM_MAX_AGE_MS = 24 * 60 * 60_000;

/** Servers' clocks may disagree a little; a note from further ahead was not made here. */
const CLOCK_SKEW_MS = 5 * 60_000;

const TOKEN_VERSION = "v1";

// v1.<milliseconds since 1970 in base 36>.<12 random bytes>.<HMAC-SHA256>, all base64url.
const TOKEN_PATTERN = /^v1\.([0-9a-z]{1,10})\.([A-Za-z0-9_-]{16})\.([A-Za-z0-9_-]{43})$/;

function signatureOf(body: string): Buffer {
  return crypto.createHmac("sha256", getPurposeKey("signup-form")).update(body).digest();
}

/** A fresh note for one copy of the form, made when the page is. */
export function issueSignupFormToken(now: number = Date.now()): string {
  const body = `${TOKEN_VERSION}.${now.toString(36)}.${crypto.randomBytes(12).toString("base64url")}`;
  return `${body}.${signatureOf(body).toString("base64url")}`;
}

export type SignupFormRefusal =
  | "trap_filled"
  | "token_missing"
  | "token_malformed"
  | "token_forged"
  | "too_fast"
  | "expired"
  | "from_future";

export type SignupFormCheck =
  | { ok: true; nonce: string; issuedAt: number }
  | { ok: false; reason: SignupFormRefusal };

/**
 * What can be told from the post alone, with no database: the trap field and the note.
 * Values are the raw form entries, so a file where text belongs counts as filled in.
 */
export function checkSignupForm(
  fields: { token: unknown; trap: unknown },
  now: number = Date.now(),
): SignupFormCheck {
  if (fields.trap !== null && fields.trap !== undefined && fields.trap !== "") {
    return { ok: false, reason: "trap_filled" };
  }
  const token = fields.token;
  if (typeof token !== "string" || token.length === 0) {
    return { ok: false, reason: "token_missing" };
  }
  const match = TOKEN_PATTERN.exec(token);
  if (!match) return { ok: false, reason: "token_malformed" };
  const [, stamp, nonce, signature] = match as unknown as [string, string, string, string];
  const expected = signatureOf(`${TOKEN_VERSION}.${stamp}.${nonce}`);
  const given = Buffer.from(signature, "base64url");
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) {
    return { ok: false, reason: "token_forged" };
  }
  const issuedAt = Number.parseInt(stamp, 36);
  const age = now - issuedAt;
  if (age < -CLOCK_SKEW_MS) return { ok: false, reason: "from_future" };
  if (age < SIGNUP_FORM_MIN_FILL_MS) return { ok: false, reason: "too_fast" };
  if (age > SIGNUP_FORM_MAX_AGE_MS) return { ok: false, reason: "expired" };
  return { ok: true, nonce, issuedAt };
}

/**
 * Marks a note as spent, so one copy of the form makes at most one account. False when it
 * already made one. Called only once every other check has passed, so a copy that came back
 * with a mistake in it never counts.
 */
export async function spendSignupFormToken(nonce: string, ip: string | null): Promise<boolean> {
  const result = await rateLimit(`signup-form:${nonce}`, RATE_POLICIES.signupFormToken, {
    ipAddress: ip,
  });
  return result.ok;
}

export type SignupCapCheck =
  | { ok: true }
  | { ok: false; reason: "ip_daily_cap" | "site_daily_cap" };

/**
 * The day's allowance of new accounts, for this connection and then for the whole site.
 * Called just before an account is made, so only accounts that would be made count.
 */
export async function takeSignupAllowance(ip: string): Promise<SignupCapCheck> {
  const perConnection = await rateLimit(`register-day:${ip}`, RATE_POLICIES.registerDaily, {
    ipAddress: ip,
  });
  if (!perConnection.ok) return { ok: false, reason: "ip_daily_cap" };
  const site = await rateLimit("register-site-day", RATE_POLICIES.registerSiteDaily);
  if (!site.ok) return { ok: false, reason: "site_daily_cap" };
  return { ok: true };
}
