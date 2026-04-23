import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { AdminSection } from "../_sections/AdminSection";

export default async function AdminPrayers() {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");
  const prayers = await prisma.prayer.findMany({
    orderBy: { updatedAt: "desc" },
    take: 100,
  });
  return (
    <AdminSection titleKey="admin.card.prayers">
      <div className="vf-card rounded-sm">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-ink/10 text-xs uppercase tracking-[0.2em] text-ink-faint">
              <th className="px-5 py-4">Title</th>
              <th className="px-5 py-4">Category</th>
              <th className="px-5 py-4">Status</th>
              <th className="px-5 py-4">Updated</th>
            </tr>
          </thead>
          <tbody>
            {prayers.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-5 py-10 text-center font-serif text-ink-faint">
                  No prayers yet. Seed or ingest.
                </td>
              </tr>
            ) : (
              prayers.map((p) => (
                <tr key={p.id} className="border-b border-ink/5 font-serif">
                  <td className="px-5 py-4 text-lg">{p.defaultTitle}</td>
                  <td className="px-5 py-4 text-ink-soft">{p.category}</td>
                  <td className="px-5 py-4 text-ink-soft">{p.status}</td>
                  <td className="px-5 py-4 text-ink-faint">
                    {p.updatedAt.toISOString().slice(0, 10)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </AdminSection>
  );
}
