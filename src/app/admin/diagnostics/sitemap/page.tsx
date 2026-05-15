import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { runSitemapDiagnostics } from "@/lib/diagnostics";
import { DiagnosticSectionPanel } from "@/components/diagnostics/DiagnosticSectionPanel";
import { AdminSection } from "../../_sections/AdminSection";

export const dynamic = "force-dynamic";

/**
 * /admin/diagnostics/sitemap — verifies the sitemap entries, robots,
 * and the in-process reachability of every public route the sitemap
 * promises. Backed by the same `runSitemapDiagnostics()` function the
 * `/api/admin/diagnostics/sitemap` route calls — single source of
 * truth, no duplicated check logic.
 */
export default async function SitemapDiagnostics() {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");
  const section = await runSitemapDiagnostics();
  return (
    <AdminSection
      titleKey="admin.card.diagnostics"
      subtitle="Sitemap & Link Paths — verify every static and dynamic route renders, including profile, content, and admin pages. Backed by /api/admin/diagnostics/sitemap."
    >
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <Link href="/admin/diagnostics" className="vf-nav-link">
          ← Diagnostics
        </Link>
        <Link href="/sitemap.xml" className="vf-nav-link">
          Open sitemap.xml →
        </Link>
        <Link href="/robots.txt" className="vf-nav-link">
          Open robots.txt →
        </Link>
      </div>
      <DiagnosticSectionPanel section={section} />
    </AdminSection>
  );
}
