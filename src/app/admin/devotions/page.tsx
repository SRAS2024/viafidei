import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { listAdminDevotions } from "@/lib/data/devotions";
import { AdminSection } from "../_sections/AdminSection";

export default async function AdminDevotions() {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");
  const rows = await listAdminDevotions();
  return (
    <AdminSection titleKey="admin.card.devotions">
      <div className="vf-card rounded-sm">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-ink/10 text-xs uppercase tracking-[0.2em] text-ink-faint">
              <th className="px-5 py-4">Title</th>
              <th className="px-5 py-4">Duration</th>
              <th className="px-5 py-4">Status</th>
              <th className="px-5 py-4">Updated</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-5 py-10 text-center font-serif text-ink-faint">
                  No devotions yet. Seed or ingest.
                </td>
              </tr>
            ) : (
              rows.map((d) => (
                <tr key={d.id} className="border-b border-ink/5 font-serif">
                  <td className="px-5 py-4 text-lg">{d.title}</td>
                  <td className="px-5 py-4 text-ink-soft">
                    {d.durationMinutes ? `${d.durationMinutes} min` : "—"}
                  </td>
                  <td className="px-5 py-4 text-ink-soft">{d.status}</td>
                  <td className="px-5 py-4 text-ink-faint">
                    {d.updatedAt.toISOString().slice(0, 10)}
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
