import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { listAdminParishes } from "@/lib/data/parishes";
import { AdminSection } from "../_sections/AdminSection";
import { AdminStatusButton } from "../_sections/AdminStatusButton";

const STATUS_COLORS: Record<string, string> = {
  PUBLISHED: "text-green-700",
  DRAFT: "text-ink-faint",
  REVIEW: "text-amber-600",
  ARCHIVED: "text-red-600",
};

export default async function AdminParishes() {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");
  const rows = await listAdminParishes();
  return (
    <AdminSection titleKey="admin.card.parishes">
      <div className="vf-card rounded-sm overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-ink/10 text-xs uppercase tracking-[0.2em] text-ink-faint">
              <th className="px-5 py-4">Name</th>
              <th className="px-5 py-4">Location</th>
              <th className="px-5 py-4">Status</th>
              <th className="px-5 py-4">Updated</th>
              <th className="px-5 py-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center font-serif text-ink-faint">
                  No parishes yet. Run the seed script or trigger ingestion.
                </td>
              </tr>
            ) : (
              rows.map((p) => (
                <tr key={p.id} className="border-b border-ink/5 font-serif">
                  <td className="px-5 py-4">
                    <a
                      href={`/spiritual-guidance/${p.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-lg hover:underline"
                    >
                      {p.name}
                    </a>
                  </td>
                  <td className="px-5 py-4 text-ink-soft">
                    {[p.city, p.country].filter(Boolean).join(", ") || "—"}
                  </td>
                  <td
                    className={`px-5 py-4 font-semibold text-sm ${STATUS_COLORS[p.status] ?? "text-ink-soft"}`}
                  >
                    {p.status}
                  </td>
                  <td className="px-5 py-4 text-ink-faint">
                    {p.updatedAt.toISOString().slice(0, 10)}
                  </td>
                  <td className="px-5 py-4">
                    <AdminStatusButton
                      id={p.id}
                      currentStatus={p.status}
                      apiBase="/api/admin/parishes"
                    />
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
