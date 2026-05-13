import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { AdminSection } from "../_sections/AdminSection";
import { PublishListClient } from "./PublishListClient";

export const dynamic = "force-dynamic";

export default async function AdminPublishListPage() {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");

  return (
    <AdminSection
      titleKey="admin.card.publishList"
      subtitle="Items waiting for an admin publish action. Auto-ingested rows from the credibility allowlist publish themselves; only your manual edits or new entries land here."
    >
      <PublishListClient />
    </AdminSection>
  );
}
