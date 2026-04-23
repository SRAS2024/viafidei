import { NextResponse, type NextRequest } from "next/server";
import { adminLoginSchema, verifyAdminCredentials, writeAudit } from "@/lib/admin-auth";
import { getSession } from "@/lib/session";
import { rateLimit, RATE_POLICIES } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const parsed = adminLoginSchema.safeParse({
    username: form.get("username"),
    password: form.get("password"),
  });

  if (!parsed.success) {
    return NextResponse.redirect(new URL("/admin/login?error=invalid", req.url), 303);
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const limit = rateLimit(`admin-login:${ip}`, RATE_POLICIES.adminLogin);
  if (!limit.ok) {
    return NextResponse.redirect(new URL("/admin/login?error=invalid", req.url), 303);
  }

  const ok = verifyAdminCredentials(parsed.data.username, parsed.data.password);
  if (!ok) {
    await writeAudit({
      action: "admin.login.failed",
      entityType: "Session",
      entityId: "admin",
      actorUsername: parsed.data.username,
      ipAddress: ip,
      userAgent: req.headers.get("user-agent"),
    });
    return NextResponse.redirect(new URL("/admin/login?error=invalid", req.url), 303);
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
    userAgent: req.headers.get("user-agent"),
  });

  return NextResponse.redirect(new URL("/admin?welcome=1", req.url), 303);
}
