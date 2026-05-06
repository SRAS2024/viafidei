import { NextResponse, type NextRequest } from "next/server";
import { adminLoginSchema, verifyAdminCredentials, getSession } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { rateLimit, RATE_POLICIES } from "@/lib/security/rate-limit";
import { getClientIp, getUserAgent } from "@/lib/security/request";

const LOGIN_INVALID = "/admin/login?error=invalid";

export async function POST(req: NextRequest) {
  // formData() throws on an unexpected Content-Type. Treat that the same as
  // a missing/invalid field so the caller is redirected back with the
  // standard error rather than triggering the runtime error boundary.
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.redirect(new URL(LOGIN_INVALID, req.url), 303);
  }
  const parsed = adminLoginSchema.safeParse({
    username: form.get("username"),
    password: form.get("password"),
  });

  if (!parsed.success) {
    return NextResponse.redirect(new URL(LOGIN_INVALID, req.url), 303);
  }

  const ip = getClientIp(req);
  const userAgent = getUserAgent(req);
  const limit = await rateLimit(`admin-login:${ip}`, RATE_POLICIES.adminLogin, {
    ipAddress: ip,
  });
  if (!limit.ok) {
    return NextResponse.redirect(new URL(LOGIN_INVALID, req.url), 303);
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
    return NextResponse.redirect(new URL(LOGIN_INVALID, req.url), 303);
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

  return NextResponse.redirect(new URL("/admin?welcome=1", req.url), 303);
}
