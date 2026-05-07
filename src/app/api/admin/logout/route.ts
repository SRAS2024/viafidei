import { type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { getClientIpOrNull, getUserAgent, redirectTo } from "@/lib/security/request";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (session.role === "ADMIN") {
    await writeAudit({
      action: "admin.logout",
      entityType: "Session",
      entityId: "admin",
      actorUsername: session.userEmail ?? "admin",
      ipAddress: getClientIpOrNull(req),
      userAgent: getUserAgent(req),
    });
  }
  session.destroy();
  return redirectTo(req, "/admin/login");
}
