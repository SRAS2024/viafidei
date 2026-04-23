import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { writeAudit } from "@/lib/admin-auth";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (session.role === "ADMIN") {
    await writeAudit({
      action: "admin.logout",
      entityType: "Session",
      entityId: "admin",
      actorUsername: session.userEmail ?? "admin",
      ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      userAgent: req.headers.get("user-agent"),
    });
  }
  session.destroy();
  return NextResponse.redirect(new URL("/admin/login", req.url), 303);
}
