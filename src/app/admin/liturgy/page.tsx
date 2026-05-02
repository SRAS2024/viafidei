import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { AdminSection } from "../_sections/AdminSection";

export default async function AdminLiturgy() {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");
  return (
    <AdminSection titleKey="admin.card.liturgy">
      <div className="vf-card rounded-sm p-8 text-center font-serif text-ink-soft">
        Liturgy content surface. Connect calendar and rites ingestion jobs here.
      </div>
    </AdminSection>
  );
}
