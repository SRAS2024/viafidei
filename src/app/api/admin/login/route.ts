import { NextResponse, type NextRequest } from "next/server";
import {
  adminLoginSchema,
  verifyAdminCredentials,
  getSession,
} from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { rateLimit, RATE_POLICIES } from "@/lib/security/rate-limit";
import { getClientIp, getUserAgent } from "@/lib/security/request";

const LOGIN_INVALID = "/admin/login?error=invalid";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const parsed = adminLoginSchema.safeParse({
    username: form.get("username"),
    password: form.get("password"),
  });

  if (!parsed.success) {
    return NextResponse.redirect(new URL(LOGIN_INVALID, req.url), 303);
  }

  const ip = getClientIp(req);
  const userAgent = getUserAgent(req);
  const limit = rateLimit(`admin-login:${ip}`, RATE_POLICIES.adminLogin);
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
