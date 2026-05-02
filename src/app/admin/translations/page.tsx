import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getTranslationCounts } from "@/lib/data/translations";
import { AdminSection } from "../_sections/AdminSection";

export default async function AdminTranslations() {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");
  const counts = await getTranslationCounts();
  return (
    <AdminSection titleKey="admin.card.translations">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="vf-card rounded-sm p-6 text-center">
          <p className="vf-eyebrow">Prayers</p>
          <p className="mt-3 font-display text-4xl">{counts.prayerCount}</p>
        </div>
        <div className="vf-card rounded-sm p-6 text-center">
          <p className="vf-eyebrow">Saints</p>
          <p className="mt-3 font-display text-4xl">{counts.saintCount}</p>
        </div>
        <div className="vf-card rounded-sm p-6 text-center">
          <p className="vf-eyebrow">Apparitions</p>
          <p className="mt-3 font-display text-4xl">{counts.apparitionCount}</p>
        </div>
      </div>
    </AdminSection>
  );
}
