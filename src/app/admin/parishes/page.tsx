import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { AdminSection } from "../_sections/AdminSection";

export default async function AdminParishes() {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");
  const rows = await prisma.parish.findMany({ orderBy: { name: "asc" }, take: 200 });
  return (
    <AdminSection titleKey="admin.card.parishes">
      <div className="vf-card rounded-sm p-6">
        {rows.length === 0 ? (
          <p className="text-center font-serif text-ink-faint">No parishes yet.</p>
        ) : (
          <ul className="divide-y divide-ink/10">
            {rows.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-4 font-serif">
                <span className="text-lg">{p.name}</span>
                <span className="text-sm text-ink-faint">
                  {[p.city, p.country].filter(Boolean).join(", ") || "—"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AdminSection>
  );
}
