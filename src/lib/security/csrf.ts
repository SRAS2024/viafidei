/**
 * Origin-based CSRF protection for state-changing requests.
 *
 * We rely on the browser-attached Origin header for cross-origin
 * request detection. Modern browsers send Origin on every non-GET
 * fetch / form submit, so a cross-site form post lands with an
 * Origin header that does not match the app's public origin.
 *
 * The origin we compare *against* is deliberately NOT read from the
 * request. In production it is the constant canonical set derived from
 * src/lib/config.ts (see getTrustedOrigins in ./request); outside
 * production it is the origin the request actually arrived on, plus
 * loopback. Deriving the expected origin from X-Forwarded-Host — as an
 * earlier revision did — means an attacker who can inject that header
 * anywhere in the proxy chain also chooses the value their own forged
 * Origin is checked against, which reduces this whole module to a no-op.
 *
 * This module exposes `assertSameOrigin(req)` which returns a 403
 * Response when the request looks cross-origin, and `null` when
 * it is safe to proceed. Routes call it as the first thing after
 * `requireAdmin()`.
 *
 * Combined with the SameSite=Lax / SameSite=Strict cookies the app
 * already issues, this prevents a malicious external page from
 * triggering admin mutations even if an admin happens to have a
 * valid session cookie.
 *
 * The helper is intentionally a pure function of request headers
 * (no DB call, no shared state) so it runs in O(1) on every
 * mutation request without measurable overhead.
 */

import { type NextRequest } from "next/server";
import { getTrustedOrigins, isTrustedRequestOrigin } from "./request";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export type CsrfDecision =
  | { ok: true }
  | { ok: false; reason: "missing_origin" | "cross_origin"; expected: string; got: string | null };

/**
 * Decide whether the request's Origin / Referer is acceptable.
 * Returns `{ ok: true }` for safe methods or matching origins.
 */
export function evaluateCsrf(req: NextRequest): CsrfDecision {
  if (SAFE_METHODS.has(req.method)) return { ok: true };
  // The trusted set comes from application configuration in production and
  // from the request only outside it — see getTrustedOrigins. Deriving it
  // from X-Forwarded-Host here would let an attacker who can influence that
  // header pick the origin their own forged request is compared against.
  const trusted = getTrustedOrigins(req);
  const expected = trusted.join(", ");
  const origin = req.headers.get("origin");
  if (origin) {
    return isTrustedRequestOrigin(origin, trusted)
      ? { ok: true }
      : { ok: false, reason: "cross_origin", expected, got: origin };
  }
  // No Origin header — fall back to Referer.
  const referer = req.headers.get("referer");
  if (referer) {
    try {
      const refOrigin = new URL(referer).origin;
      return isTrustedRequestOrigin(refOrigin, trusted)
        ? { ok: true }
        : { ok: false, reason: "cross_origin", expected, got: refOrigin };
    } catch {
      return { ok: false, reason: "missing_origin", expected, got: referer };
    }
  }
  return { ok: false, reason: "missing_origin", expected, got: null };
}

/**
 * Returns a 403 Response when CSRF check fails, `null` when the
 * request is safe to proceed.
 *
 * Callers in admin / ingestion / content-factory / data-management
 * routes invoke this immediately after `requireAdmin()`.
 */
export function assertCsrfOk(req: NextRequest): Response | null {
  const decision = evaluateCsrf(req);
  if (decision.ok) return null;
  return new Response(
    JSON.stringify({
      error: "csrf",
      reason: decision.reason,
    }),
    {
      status: 403,
      headers: { "content-type": "application/json; charset=utf-8" },
    },
  );
}
