/**
 * Server-side guard for banned devices. Two entry points:
 *
 *   * `assertNotBanned(req)` — for Node-runtime route handlers
 *     (`/api/*`). Returns a 403 Response when the request's device
 *     credential is banned, `null` otherwise.
 *
 *   * `isCurrentDeviceBanned()` — for Server Components / layouts.
 *     Reads the device cookie via `next/headers` and returns a
 *     boolean. The caller redirects or renders an error page.
 *
 * The guard is read-only: it cannot unban. The "no admin unban UI"
 * rule is enforced by not exposing the inverse function from this
 * module or anywhere else in the codebase.
 */

import { type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { isDeviceBanned, recordBannedDeviceHit } from "./security-event-store";
import { DEVICE_CREDENTIAL_COOKIE } from "@/middleware";

/**
 * Returns the raw device-credential cookie value for the given
 * request (or null when the cookie is missing). Used at the
 * Node-runtime boundary; the middleware sets the cookie on first
 * request.
 */
export function readDeviceCredential(req: NextRequest): string | null {
  const c = req.cookies.get(DEVICE_CREDENTIAL_COOKIE);
  return c?.value ?? null;
}

/**
 * Returns a 403 Response when the request's device credential is
 * banned, `null` otherwise. The guard records a "hit" so the admin
 * page can see when banned devices retry.
 */
export async function assertNotBanned(req: NextRequest): Promise<Response | null> {
  const credential = readDeviceCredential(req);
  if (!credential) return null;
  const banned = await isDeviceBanned(credential).catch(() => false);
  if (!banned) return null;
  await recordBannedDeviceHit(credential).catch(() => undefined);
  return new Response("Forbidden", {
    status: 403,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

/**
 * Server Component / layout variant. Reads the device cookie via
 * `next/headers` and returns true when the device is banned. Records
 * a hit so the admin page can see banned-device retries.
 */
export async function isCurrentDeviceBanned(): Promise<boolean> {
  const store = await cookies();
  const credential = store.get(DEVICE_CREDENTIAL_COOKIE)?.value ?? null;
  if (!credential) return false;
  const banned = await isDeviceBanned(credential).catch(() => false);
  if (banned) {
    await recordBannedDeviceHit(credential).catch(() => undefined);
  }
  return banned;
}
