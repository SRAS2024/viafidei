import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { AdminSection } from "../_sections/AdminSection";

export default async function AdminSearchPanel() {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");
  return (
    <AdminSection titleKey="admin.card.search">
      <div className="vf-card rounded-sm p-8 text-center font-serif text-ink-soft">
        Search index health and reindex controls. The current build queries published content
        directly from PostgreSQL — POST <code>/api/admin/search/reindex</code> runs the housekeeping
        prune (rate-limit buckets, expired tokens) and is audited.
      </div>
    </AdminSection>
  );
}
