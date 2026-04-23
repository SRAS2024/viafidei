import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { AdminSection } from "../_sections/AdminSection";

export default async function AdminApparitions() {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");
  const rows = await prisma.marianApparition.findMany({ orderBy: { title: "asc" } });
  return (
    <AdminSection titleKey="admin.card.apparitions">
      <div className="vf-card rounded-sm p-6">
        {rows.length === 0 ? (
          <p className="text-center font-serif text-ink-faint">No apparitions yet.</p>
        ) : (
          <ul className="divide-y divide-ink/10">
            {rows.map((a) => (
              <li key={a.id} className="flex items-center justify-between py-4 font-serif">
                <span className="text-lg">{a.title}</span>
                <span className="text-sm text-ink-faint">{a.location ?? "—"}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AdminSection>
  );
}
