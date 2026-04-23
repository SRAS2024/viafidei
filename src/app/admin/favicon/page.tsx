import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { AdminSection } from "../_sections/AdminSection";

export default async function AdminFavicon() {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");

  const setting = await prisma.siteSetting.findUnique({ where: { key: "favicon" } });
  const current = setting?.valueJson as { url?: string; altText?: string } | null;

  return (
    <AdminSection titleKey="admin.card.favicon">
      <div className="vf-card rounded-sm p-8">
        <form method="post" action="/api/admin/favicon" className="flex flex-col gap-5">
          <div>
            <label className="vf-label" htmlFor="faviconUrl">Favicon URL</label>
            <input
              id="faviconUrl"
              name="url"
              type="url"
              defaultValue={current?.url ?? ""}
              required
              className="vf-input"
              placeholder="https://…"
            />
            <p className="mt-2 text-xs text-ink-faint">
              Stored in the database on SiteSetting and propagated through the platform.
            </p>
          </div>
          <div>
            <label className="vf-label" htmlFor="faviconAlt">Alt text</label>
            <input
              id="faviconAlt"
              name="altText"
              type="text"
              defaultValue={current?.altText ?? "Via Fidei emblem"}
              className="vf-input"
            />
          </div>
          <button type="submit" className="vf-btn vf-btn-primary">
            Save favicon
          </button>
        </form>
      </div>
    </AdminSection>
  );
}
