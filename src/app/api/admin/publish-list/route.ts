import { requireAdmin } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { listPendingPublishItems } from "@/lib/data/publish-list";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return jsonError("unauthorized");
  const items = await listPendingPublishItems();
  return jsonOk({
    items: items.map((i) => ({
      id: i.id,
      entityType: i.entityType,
      type: i.type,
      title: i.title,
      slug: i.slug,
      status: i.status,
      page: i.page,
      updatedAt: i.updatedAt.toISOString(),
      createdAt: i.createdAt.toISOString(),
    })),
    total: items.length,
  });
}
