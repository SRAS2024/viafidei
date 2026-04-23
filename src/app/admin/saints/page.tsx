import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { AdminSection } from "../_sections/AdminSection";

export default async function AdminSaints() {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");
  const rows = await prisma.saint.findMany({ orderBy: { canonicalName: "asc" }, take: 200 });
  return (
    <AdminSection titleKey="admin.card.saints">
      <div className="vf-card rounded-sm p-6">
        {rows.length === 0 ? (
          <p className="text-center font-serif text-ink-faint">No saints yet.</p>
        ) : (
          <ul className="divide-y divide-ink/10">
            {rows.map((s) => (
              <li key={s.id} className="flex items-center justify-between py-4 font-serif">
                <span className="text-lg">{s.canonicalName}</span>
                <span className="text-sm text-ink-faint">{s.feastDay ?? "—"}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AdminSection>
  );
}
