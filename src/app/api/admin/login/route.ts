import { type NextRequest } from "next/server";
import { adminLoginSchema, verifyAdminCredentials, getSession } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { hasKnownAdminDevice } from "@/lib/audit/admin-action-log";
import { rateLimit, RATE_POLICIES } from "@/lib/security/rate-limit";
import { getClientIp, getUserAgent, redirectTo } from "@/lib/security/request";
import { reportSecurityBreach, reportSuspiciousActivity } from "@/lib/security/security-events";
import {
  recordAdminPasswordFailure,
  resetAdminPasswordFailureCounter,
} from "@/lib/security/admin-failure-counter";
import {
  recordAdminLoginFailure,
  recordAdminLoginSuccess,
} from "@/lib/security/admin-login-events";
import { describeDevice } from "@/lib/security/device-info";
import {
  deviceCredentialFingerprint,
  ipFingerprint,
  userAgentFingerprint,
} from "@/lib/security/hash";
import {
  defendConfirmedBruteForce,
  defendFailedAdminLogin,
} from "@/lib/admin-worker/request-defender";
import { prisma as adminWorkerPrisma } from "@/lib/db/client";
import { DEVICE_CREDENTIAL_COOKIE } from "@/middleware";

const LOGIN_ROUTE = "/api/admin/login";

// Admin credential verification (timing-safe + iron-session) needs Node.
export const runtime = "nodejs";

const LOGIN_INVALID = "/admin/login?error=invalid";

export async function POST(req: NextRequest) {
  // formData() throws on an unexpected Content-Type. Treat that the same as
  // a missing/invalid field so the caller is redirected back with the
  // standard error rather than triggering the runtime error boundary.
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return redirectTo(req, LOGIN_INVALID);
  }
  const parsed = adminLoginSchema.safeParse({
    username: form.get("username"),
    password: form.get("password"),
  });

  if (!parsed.success) {
    return redirectTo(req, LOGIN_INVALID);
  }

  const ip = getClientIp(req);
  const userAgent = getUserAgent(req);
  const deviceCredential = req.cookies.get(DEVICE_CREDENTIAL_COOKIE)?.value ?? null;
  const limit = await rateLimit(`admin-login:${ip}`, RATE_POLICIES.adminLogin, {
    ipAddress: ip,
  });
  if (!limit.ok) {
    // Repeated admin-login attempts that blow through the rate limit
    // are an unauthorised access probe by definition — treat as a
    // Security Breach so the operator hears about it immediately.
    void reportSecurityBreach({
      kind: "admin_login_rate_limited",
      summary: `Admin login attempts from ${ip ?? "unknown"} exceeded the rate limit (${RATE_POLICIES.adminLogin.max}/15min).`,
      ipAddress: ip ?? undefined,
      userAgent: userAgent ?? undefined,
      route: "/api/admin/login",
      deviceCredential: deviceCredential ?? undefined,
      attemptedAccountOrRoute: parsed.data.username,
    });
    return redirectTo(req, LOGIN_INVALID);
  }

  const ok = verifyAdminCredentials(parsed.data.username, parsed.data.password);
  if (!ok) {
    await writeAudit({
      action: "admin.login.failed",
      entityType: "Session",
      entityId: "admin",
      actorUsername: parsed.data.username,
      ipAddress: ip,
      userAgent,
    });
    // Every failed attempt is recorded as a benign-audit SecurityEvent
    // of type `admin_login_failed`.
    const failedEventId = await recordAdminLoginFailure({
      username: parsed.data.username,
      ipAddress: ip,
      userAgent,
      deviceCredential,
      route: LOGIN_ROUTE,
    }).catch(() => null);
    // Track consecutive failures by account + IP + device credential.
    // >= 3 in a row -> Suspicious Activity email; > 15 -> escalate to
    // Security Breach (brute-force). The streak is scoped to this
    // (account, IP, device) tuple, so a success elsewhere cannot erase
    // attack evidence here.
    const failure = recordAdminPasswordFailure({
      account: parsed.data.username,
      ipAddress: ip,
      deviceCredential,
    });

    // Wire the Admin Worker request-path defender (spec §21). The
    // defender records an AdminWorkerSecurityAction row alongside the
    // existing SecurityEvent so the diagnostics card can show what
    // the worker did about the failure.
    const requestDefenderInput = {
      prisma: adminWorkerPrisma,
      route: LOGIN_ROUTE,
      ipHash: ipFingerprint(ip),
      deviceFingerprintHash: deviceCredentialFingerprint(deviceCredential),
      userAgentHash: userAgentFingerprint(userAgent),
      securityEventId: failedEventId ?? undefined,
    };
    if (failure.classification === "breach") {
      void defendConfirmedBruteForce({
        ...requestDefenderInput,
        attemptsInWindow: failure.count,
      });
    } else {
      void defendFailedAdminLogin({
        ...requestDefenderInput,
        attemptsInWindow: failure.count,
      });
    }
    const device = describeDevice(userAgent);
    const deviceKnown = await hasKnownAdminDevice(deviceCredential).catch(() => false);
    if (failure.classification === "breach") {
      void reportSecurityBreach({
        kind: "admin_password_brute_force",
        summary: `${failure.count} consecutive admin-password failures within ${Math.round(failure.windowMs / 60000)} minutes from ${ip ?? "unknown"} — brute-force pattern.`,
        ipAddress: ip ?? undefined,
        userAgent: userAgent ?? undefined,
        route: LOGIN_ROUTE,
        deviceCredential: deviceCredential ?? undefined,
        attemptedAccountOrRoute: parsed.data.username,
        attemptedAction: "admin_password_brute_force",
        detail: {
          "Failed attempts": String(failure.count),
          "First failed attempt": new Date(failure.firstFailAt).toISOString(),
          "Most recent failed attempt": new Date(failure.lastFailAt).toISOString(),
          "Username attempted": parsed.data.username,
          "Device summary": device.summary,
          "Device known": deviceKnown ? "yes" : "no",
          ...(failedEventId ? { "Security event id": failedEventId } : {}),
        },
      });
    } else if (failure.classification === "suspicious") {
      // Three or more consecutive failures. `reportSuspiciousActivity`
      // dedupes within a 5-minute window, so the threshold sends ONE
      // Suspicious Activity email — not one per failed attempt.
      void reportSuspiciousActivity({
        kind: "admin_failed_login_threshold_reached",
        summary: `${failure.count} consecutive admin-password failures from ${ip ?? "unknown"}. The failed-login threshold has been reached.`,
        ipAddress: ip ?? undefined,
        userAgent: userAgent ?? undefined,
        route: LOGIN_ROUTE,
        deviceCredential: deviceCredential ?? undefined,
        attemptedAccountOrRoute: parsed.data.username,
        recommendedAction:
          "Verify whether the admin account holder is attempting access from a new device. If not, treat as suspected probing.",
        detail: {
          "Failed attempts": String(failure.count),
          "First failed attempt": new Date(failure.firstFailAt).toISOString(),
          "Most recent failed attempt": new Date(failure.lastFailAt).toISOString(),
          "Username attempted": parsed.data.username,
          "Device summary": device.summary,
          "Device known": deviceKnown ? "yes" : "no",
          ...(failedEventId ? { "Security event id": failedEventId } : {}),
        },
      });
    }
    return redirectTo(req, LOGIN_INVALID);
  }

  // Reset the consecutive-failure counter on a successful login.
  resetAdminPasswordFailureCounter({
    account: parsed.data.username,
    ipAddress: ip,
    deviceCredential,
  });

  const session = await getSession();
  session.role = "ADMIN";
  session.userEmail = parsed.data.username;
  session.adminSignedInAt = Date.now();
  await session.save();

  await writeAudit({
    action: "admin.login.success",
    entityType: "Session",
    entityId: "admin",
    actorUsername: parsed.data.username,
    ipAddress: ip,
    userAgent,
  });

  // A successful sign-in records a SecurityEvent (admin_login_success)
  // and an AdminActionLog row, and sends the Admin Log In email. It
  // never sends a Suspicious Activity email — a valid login is
  // expected activity. The helper is best-effort and never throws.
  await recordAdminLoginSuccess({
    username: parsed.data.username,
    ipAddress: ip,
    userAgent,
    deviceCredential,
    route: LOGIN_ROUTE,
  });

  return redirectTo(req, "/admin?welcome=1");
}
