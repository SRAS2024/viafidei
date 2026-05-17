import { type NextRequest } from "next/server";
import { adminLoginSchema, verifyAdminCredentials, getSession } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { rateLimit, RATE_POLICIES } from "@/lib/security/rate-limit";
import { getClientIp, getUserAgent, redirectTo } from "@/lib/security/request";
import { reportSecurityBreach, reportSuspiciousActivity } from "@/lib/security/security-events";
import {
  recordAdminPasswordFailure,
  resetAdminPasswordFailureCounter,
} from "@/lib/security/admin-failure-counter";
import { DEVICE_CREDENTIAL_COOKIE } from "@/middleware";

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
    // Track consecutive failures by account + IP + device credential.
    // > 3 in a row -> Suspicious Activity email; > 15 -> escalate to
    // Security Breach (brute-force).
    const failure = recordAdminPasswordFailure({
      account: parsed.data.username,
      ipAddress: ip,
      deviceCredential,
    });
    if (failure.classification === "breach") {
      void reportSecurityBreach({
        kind: "admin_password_brute_force",
        summary: `${failure.count} consecutive admin-password failures within ${Math.round(failure.windowMs / 60000)} minutes from ${ip ?? "unknown"} — brute-force pattern.`,
        ipAddress: ip ?? undefined,
        userAgent: userAgent ?? undefined,
        route: "/api/admin/login",
        deviceCredential: deviceCredential ?? undefined,
        attemptedAccountOrRoute: parsed.data.username,
        attemptedAction: "admin_password_brute_force",
      });
    } else if (failure.classification === "suspicious") {
      void reportSuspiciousActivity({
        kind: "admin_password_failed_repeatedly",
        summary: `${failure.count} consecutive admin-password failures from ${ip ?? "unknown"}. Investigate at your discretion.`,
        ipAddress: ip ?? undefined,
        userAgent: userAgent ?? undefined,
        route: "/api/admin/login",
        deviceCredential: deviceCredential ?? undefined,
        attemptedAccountOrRoute: parsed.data.username,
        recommendedAction:
          "Verify whether the admin account holder is attempting access from a new device. If not, treat as suspected probing.",
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

  return redirectTo(req, "/admin?welcome=1");
}
