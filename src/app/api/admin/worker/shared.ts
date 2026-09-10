/**
 * Shared plumbing for the three Admin Worker remote-control routes.
 *
 * Not a route: Next only treats `route.ts` / `page.tsx` as endpoints, so this
 * colocated module is just imported code. It exists so the three handlers
 * cannot drift on the two things a native client has to be able to rely on —
 * the rate-limit budgets and the exact error envelope.
 */

import type { NextRequest, NextResponse } from "next/server";

import { DEFAULT_SWITCH_CLIENT } from "@/lib/admin-worker/remote-console";
import { jsonError } from "@/lib/http";
import { REQUEST_ID_HEADER } from "@/lib/observability";
import { rateLimitHeaders, type RatePolicy, type RateLimitResult } from "@/lib/security/rate-limit";

/**
 * Status polling. The phone is expected to ask every 3-5 s while its screen is
 * on; 120/min leaves generous headroom for a retry storm on a flaky cellular
 * link without letting a stuck loop hammer the endpoint. The payload itself is
 * cached for 2 s server-side, so most of these cost nothing.
 */
export const WORKER_STATUS_RATE: RatePolicy = { windowMs: 60_000, max: 120 };

/**
 * Snapshot polling. The answer is cached for 30 s (running) / 5 min (idle), so
 * a higher ceiling would only serve cache hits; 30/min is enough for a phone
 * plus a second device and no more.
 */
export const WORKER_SNAPSHOT_RATE: RatePolicy = { windowMs: 60_000, max: 30 };

/**
 * FORCED snapshot refresh (`?refresh=1`). This is the only phone-triggered
 * path that can actually run ~30 production queries on demand, so it gets its
 * own tight budget: six pull-to-refresh gestures per five minutes.
 */
export const WORKER_SNAPSHOT_REFRESH_RATE: RatePolicy = { windowMs: 5 * 60_000, max: 6 };

/**
 * Switch mutations. A human flipping a toggle cannot legitimately exceed this,
 * and each one starts or stops a real workload against production.
 */
export const WORKER_SWITCH_RATE: RatePolicy = { windowMs: 60_000, max: 12 };

export function requestIdOf(req: NextRequest): string | undefined {
  return req.headers.get(REQUEST_ID_HEADER) ?? undefined;
}

/**
 * The 429 every one of these routes returns. `jsonError` does not carry
 * arbitrary headers, so the standard rate-limit headers (including
 * `Retry-After`) are set on the response it builds — a native client needs
 * `Retry-After` to back off correctly rather than guessing.
 */
export function rateLimited(
  req: NextRequest,
  result: RateLimitResult,
  policy: RatePolicy,
  scope: string,
): NextResponse {
  const res = jsonError("rate_limited", {
    message: scope,
    requestId: requestIdOf(req),
  });
  for (const [key, value] of Object.entries(rateLimitHeaders(result, policy))) {
    res.headers.set(key, value);
  }
  return res;
}

/**
 * These payloads describe a live production workload and must never sit in a
 * proxy or an on-device HTTP cache.
 */
export function noStore(res: NextResponse): NextResponse {
  res.headers.set("Cache-Control", "no-store, must-revalidate");
  return res;
}

/**
 * Action types for the durable admin action log, one per direction. Distinct
 * on purpose: that log collapses identical actions inside a 60-second window,
 * and a single `admin_worker_switch` type would swallow the OFF that follows
 * an ON — losing exactly the sequence an incident review needs.
 *
 * They live here rather than in the route file because Next validates the
 * export surface of a `route.ts`, and an extra named export there fails the
 * build.
 */
export const SWITCH_ACTION_ON = "admin_worker_switch_on";
export const SWITCH_ACTION_OFF = "admin_worker_switch_off";

/**
 * Where a switch change came from, as recorded in `MasterSwitch.changedFrom`
 * and shown on both consoles ("changed by <operator> from <client>"). It is
 * client-supplied, so it is reduced to a short slug: display text next to the
 * operator's name, never a control value.
 */
export function normalizeSwitchClient(raw: unknown): string {
  if (typeof raw !== "string") return DEFAULT_SWITCH_CLIENT;
  const slug = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  return slug || DEFAULT_SWITCH_CLIENT;
}
