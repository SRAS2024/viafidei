import { type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { jsonError, jsonOk } from "@/lib/http";
import { listAdminUsers } from "@/lib/data/admin-users";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return jsonError("unauthorized");

  const url = new URL(req.url);
  const search = url.searchParams.get("q") ?? undefined;
  const page = Number(url.searchParams.get("page") ?? "1");
  const pageSize = Number(url.searchParams.get("pageSize") ?? "20");

  try {
    const result = await listAdminUsers({
      search,
      page: Number.isFinite(page) ? page : 1,
      pageSize: Number.isFinite(pageSize) ? pageSize : 20,
    });
    return jsonOk({
      users: result.rows.map((u) => ({
        id: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        language: u.language,
        createdAt: u.createdAt.toISOString(),
        emailVerified: u.emailVerified,
        role: u.role,
      })),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      pageCount: result.pageCount,
    });
  } catch {
    return jsonError("server_error");
  }
}
