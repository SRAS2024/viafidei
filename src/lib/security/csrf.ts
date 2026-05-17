/**
 * Origin-based CSRF protection for state-changing requests.
 *
 * We rely on the browser-attached Origin header for cross-origin
 * request detection. Modern browsers send Origin on every non-GET
 * fetch / form submit, so a cross-site form post lands with an
 * Origin header that does not match the app's public origin.
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

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function getPublicOrigin(req: NextRequest): string {
  const forwardedHost = req.headers.get("x-forwarded-host");
  const forwardedProto = (req.headers.get("x-forwarded-proto") ?? "").split(",")[0]!.trim();
  const host = forwardedHost ?? req.headers.get("host") ?? "";
  const proto = forwardedProto || (process.env.NODE_ENV === "production" ? "https" : "http");
  return `${proto}://${host}`;
}

export type CsrfDecision =
  | { ok: true }
  | { ok: false; reason: "missing_origin" | "cross_origin"; expected: string; got: string | null };

/**
 * Decide whether the request's Origin / Referer is acceptable.
 * Returns `{ ok: true }` for safe methods or matching origins.
 */
export function evaluateCsrf(req: NextRequest): CsrfDecision {
  if (SAFE_METHODS.has(req.method)) return { ok: true };
  const expected = getPublicOrigin(req);
  const origin = req.headers.get("origin");
  if (origin) {
    return origin === expected
      ? { ok: true }
      : { ok: false, reason: "cross_origin", expected, got: origin };
  }
  // No Origin header — fall back to Referer.
  const referer = req.headers.get("referer");
  if (referer) {
    try {
      const refOrigin = new URL(referer).origin;
      return refOrigin === expected
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
