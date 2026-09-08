import { type NextRequest } from "next/server";

import { issueAdminTwoFactorChallenge } from "@/lib/auth/admin-2fa";
import { getPendingAdminSession } from "@/lib/auth/admin-session";
import { assertCsrfOk } from "@/lib/security/csrf";
import { getClientIp, getUserAgent, redirectTo } from "@/lib/security/request";
import { DEVICE_CREDENTIAL_COOKIE } from "@/middleware";

/**
 * Re-issue the six-digit code for a login attempt that already passed the
 * password stage (security spec items 1 / 11).
 *
 * Issuing a replacement INVALIDATES the previous code, so a resend never
 * widens the set of codes an attacker may guess — there is exactly one live
 * code per pending session at any moment. Generation is rate limited by IP,
 * pending challenge, device credential and admin identity, and blowing
 * through that limit raises a Suspicious Activity event.
 *
 * HUMAN administrator only: it requires a pending interactive admin session,
 * which no worker, cron job or ordinary user account ever has.
 */

export const runtime = "nodejs";

const CODE_STAGE = "/admin/login?stage=code&notice=sent";
const CODE_UNDELIVERED = "/admin/login?stage=code&notice=undelivered";
const SIGN_IN_AGAIN = "/admin/login?error=invalid";

export async function POST(req: NextRequest) {
  const csrf = assertCsrfOk(req);
  if (csrf) return csrf;

  const pending = await getPendingAdminSession();
  if (!pending) return redirectTo(req, SIGN_IN_AGAIN);

  const issued = await issueAdminTwoFactorChallenge({
    adminSessionId: pending.adminSessionId,
    username: pending.username,
    ipAddress: getClientIp(req),
    userAgent: getUserAgent(req),
    deviceCredential: req.cookies.get(DEVICE_CREDENTIAL_COOKIE)?.value ?? null,
  });

  // A refused resend (rate limited, or the store is unreachable) keeps the
  // administrator on the code form with the code they already have. It never
  // reports which of the two happened.
  if (!issued.ok) return redirectTo(req, CODE_UNDELIVERED);
  return redirectTo(req, issued.delivery === "sent" ? CODE_STAGE : CODE_UNDELIVERED);
}
