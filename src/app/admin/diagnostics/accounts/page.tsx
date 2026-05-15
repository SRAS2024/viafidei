import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { runAccountDiagnostics } from "@/lib/diagnostics";
import { DiagnosticSectionPanel } from "@/components/diagnostics/DiagnosticSectionPanel";
import { AdminSection } from "../../_sections/AdminSection";
import { AccountsClientChecks } from "./AccountsClientChecks";

export const dynamic = "force-dynamic";

/**
 * /admin/diagnostics/accounts — sign-up / sign-in / verification,
 * saved items, badges, journals, language, parish location lookups.
 *
 * The server-side checks are produced by the shared
 * `runAccountDiagnostics()` function (also used by
 * `/api/admin/diagnostics/accounts`) so the page and the API route
 * share one implementation. Device-side checks (device date,
 * timezone, geolocation availability) run client-side via
 * AccountsClientChecks.
 */
export default async function AccountsDiagnostics() {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");
  const section = await runAccountDiagnostics();

  return (
    <AdminSection
      titleKey="admin.card.diagnostics"
      subtitle="Accounts — sign-up / sign-in / verification, saved items, badges, journals, language, device date / timezone, and parish location lookups. Backed by /api/admin/diagnostics/accounts."
    >
      <div className="mb-6">
        <Link href="/admin/diagnostics" className="vf-nav-link">
          ← Diagnostics
        </Link>
      </div>

      <DiagnosticSectionPanel section={section} />

      <section className="mt-10">
        <h2 className="font-display text-2xl">Device-side checks</h2>
        <p className="mt-2 font-serif text-sm text-ink-soft">
          These run in this browser session and confirm the user-facing features (device date /
          timezone, language preference, location permission) are reachable.
        </p>
        <AccountsClientChecks />
      </section>
    </AdminSection>
  );
}
