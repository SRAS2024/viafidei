/**
 * Server-side guard for the banned-device middleware. Node-runtime
 * route handlers and page handlers call `assertNotBanned(req)` to
 * short-circuit a request before any side effect runs.
 *
 * The guard is read-only: it cannot unban. Returning `null` means
 * "allow the request"; returning a Response means "stop and serve
 * the 403 page".
 */

import { type NextRequest } from "next/server";
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
