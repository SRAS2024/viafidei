import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { listRecentMedia } from "@/lib/data/media";
import { AdminSection } from "../_sections/AdminSection";

export default async function AdminMedia() {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");
  const rows = await listRecentMedia();
  return (
    <AdminSection titleKey="admin.card.media">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.length === 0 ? (
          <div className="vf-card col-span-full rounded-sm p-8 text-center font-serif text-ink-faint">
            No media assets yet.
          </div>
        ) : (
          rows.map((m) => (
            <div key={m.id} className="vf-card rounded-sm p-5">
              <p className="vf-eyebrow">{m.kind}</p>
              <p className="mt-2 font-serif text-sm text-ink-soft break-all">{m.url}</p>
              <p className="mt-3 text-xs text-ink-faint">{m.reviewStatus}</p>
            </div>
          ))
        )}
      </div>
    </AdminSection>
  );
}
