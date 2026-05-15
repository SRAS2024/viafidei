import { type NextRequest } from "next/server";
import { adminLoginSchema, verifyAdminCredentials, getSession } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { rateLimit, RATE_POLICIES } from "@/lib/security/rate-limit";
import { getClientIp, getUserAgent, redirectTo } from "@/lib/security/request";
import { reportSecurityEvent } from "@/lib/security/security-events";

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
  const limit = await rateLimit(`admin-login:${ip}`, RATE_POLICIES.adminLogin, {
    ipAddress: ip,
  });
  if (!limit.ok) {
    // Repeated admin-login attempts that blow through the rate limit
    // are an unauthorised access probe by definition — treat as a
    // security breach so the operator hears about it immediately.
    void reportSecurityEvent({
      kind: "admin_login_rate_limited",
      summary: `Admin login attempts from ${ip ?? "unknown"} exceeded the rate limit (${RATE_POLICIES.adminLogin.max}/15min).`,
      ipAddress: ip ?? undefined,
      userAgent: userAgent ?? undefined,
      route: "/api/admin/login",
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
    return redirectTo(req, LOGIN_INVALID);
  }

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
