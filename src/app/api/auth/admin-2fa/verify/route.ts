import { type NextRequest } from "next/server";

import { writeAudit } from "@/lib/audit";
import { abandonAdminTwoFactorChallenges, verifyAdminTwoFactorCode } from "@/lib/auth/admin-2fa";
import {
  completeAdminTwoFactor,
  getPendingAdminSession,
  revokeCurrentAdminSession,
} from "@/lib/auth/admin-session";
import { recordAdminLoginSuccess } from "@/lib/security/admin-login-events";
import { assertCsrfOk } from "@/lib/security/csrf";
import { getClientIp, getUserAgent, redirectTo } from "@/lib/security/request";
import { DEVICE_CREDENTIAL_COOKIE } from "@/middleware";

/**
 * Stage TWO of the interactive admin sign-in (security spec items 1 / 11).
 *
 * This route is the ONLY way a password-verified PENDING admin session
 * becomes an authenticated administrator. It never trusts anything the client
 * sends about who is signing in: the account comes from the server-side
 * pending session, and the code is checked against the keyed challenge row.
 *
 * HUMAN administrator only. Ordinary user accounts never reach it, and the
 * Admin Worker and every other automated process authenticate through their
 * own machine paths — no worker, cron job or internal task ever submits a
 * code (pinned by tests/security/admin-2fa-worker-exempt.test.ts).
 *
 * The response is deliberately uninformative. Wrong code, expired challenge,
 * already-used challenge, superseded challenge and exhausted attempts all
 * produce the same generic refusal, so a submission cannot be used to probe
 * the state of the challenge.
 */

// Node runtime: HMAC verification and the session store both need node:crypto.
export const runtime = "nodejs";

const CODE_INVALID = "/admin/login?stage=code&error=code";
const SIGN_IN_AGAIN = "/admin/login?error=invalid";

export async function POST(req: NextRequest) {
  // Origin-based CSRF. A cross-site page must not be able to spend an
  // administrator's guesses or complete their sign-in for them.
  const csrf = assertCsrfOk(req);
  if (csrf) return csrf;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    // A mistyped Content-Type is handled like any other bad submission.
    return redirectTo(req, CODE_INVALID);
  }

  const ip = getClientIp(req);
  const userAgent = getUserAgent(req);
  const deviceCredential = req.cookies.get(DEVICE_CREDENTIAL_COOKIE)?.value ?? null;

  // The login attempt this code belongs to. No pending session means there is
  // nothing to verify — start over rather than hinting at why.
  const pending = await getPendingAdminSession();
  if (!pending) return redirectTo(req, SIGN_IN_AGAIN);

  const submitted = form.get("code");
  const actor = {
    adminSessionId: pending.adminSessionId,
    username: pending.username,
    ipAddress: ip,
    userAgent,
    deviceCredential,
  };
  const result = await verifyAdminTwoFactorCode(
    actor,
    typeof submitted === "string" ? submitted : "",
  );

  if (!result.ok) {
    if (result.terminal) {
      // The attempt is over: expired, exhausted, consumed or superseded. Kill
      // the challenge AND the pending session so nothing survives to be
      // retried, then send the administrator back to the password form. The
      // refusal itself says nothing about which of those it was.
      await abandonAdminTwoFactorChallenges(pending.adminSessionId);
      await revokeCurrentAdminSession("two_factor_not_completed");
      return redirectTo(req, SIGN_IN_AGAIN);
    }
    return redirectTo(req, CODE_INVALID);
  }

  // Verified. Promote the session — this rotates the session id and is the
  // single place in the codebase that grants the ADMIN role. It re-checks the
  // store, so a race that revoked the pending session still fails closed.
  const completed = await completeAdminTwoFactor({
    ipAddress: ip,
    userAgent,
    deviceCredential,
  });
  if (!completed.ok) {
    await revokeCurrentAdminSession("two_factor_promotion_failed");
    return redirectTo(req, SIGN_IN_AGAIN);
  }

  await writeAudit({
    action: "admin.login.success",
    entityType: "Session",
    entityId: "admin",
    actorUsername: completed.username,
    ipAddress: ip,
    userAgent,
  });

  // Only now is this a completed admin sign-in: SecurityEvent
  // (admin_login_success), AdminActionLog row and the Admin Log In email.
  // Best-effort and never throws.
  await recordAdminLoginSuccess({
    username: completed.username,
    ipAddress: ip,
    userAgent,
    deviceCredential,
    route: "/api/auth/admin-2fa/verify",
  });

  return redirectTo(req, "/admin?welcome=1");
}
