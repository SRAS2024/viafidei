import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import { AdminSection } from "../_sections/AdminSection";

export default async function AdminSearchPanel() {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");
  return (
    <AdminSection titleKey="admin.card.search">
      <div className="vf-card rounded-sm p-8 text-center font-serif text-ink-soft">
        Search index health and reindex controls. Baseline uses PostgreSQL full-text; upgradeable to
        Meilisearch or OpenSearch per README.
      </div>
    </AdminSection>
  );
}
