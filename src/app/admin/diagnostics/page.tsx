import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { AdminSection } from "../_sections/AdminSection";

export const dynamic = "force-dynamic";

const DIAGNOSTIC_AREAS = [
  {
    href: "/admin/diagnostics/email",
    eyebrow: "I.",
    title: "Email",
    description:
      "Test welcome, verification, resend-verification, forgot-password, and reset-password flows. Inspect provider config and run the end-to-end self-test.",
  },
  {
    href: "/admin/diagnostics/ingestion",
    eyebrow: "II.",
    title: "Ingestion & Data Management",
    description:
      "Inspect catalog health: validation pipeline, recent cleanup activity, automatic deletes, content counts, and recent failure details.",
  },
  {
    href: "/admin/diagnostics/sitemap",
    eyebrow: "III.",
    title: "Sitemap & Link Paths",
    description:
      "Check internal site links, navigation paths, dynamic content routes, profile flows, admin flows, and major button targets.",
  },
  {
    href: "/admin/diagnostics/accounts",
    eyebrow: "IV.",
    title: "Accounts",
    description:
      "Verify sign-up, sign-in, sign-out, verification, saved items, badges, journaling, language persistence, device-date / timezone, and parish-location lookups.",
  },
] as const;

export default async function AdminDiagnostics() {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");
  return (
    <AdminSection
      titleKey="admin.card.diagnostics"
      subtitle="One hub for every diagnostic the Via Fidei admin can run. Each area opens its own dedicated page with results, last-run timestamps, and useful failure detail when something breaks."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {DIAGNOSTIC_AREAS.map((area) => (
          <Link
            key={area.href}
            href={area.href}
            className="vf-card flex h-full flex-col rounded-sm p-6 transition hover:border-ink/30 hover:-translate-y-0.5"
          >
            <p className="vf-eyebrow">{area.eyebrow}</p>
            <h2 className="mt-2 font-display text-2xl">{area.title}</h2>
            <p className="mt-3 font-serif text-sm leading-relaxed text-ink-soft">
              {area.description}
            </p>
            <p className="vf-nav-link mt-4 text-sm">Open →</p>
          </Link>
        ))}
      </div>
    </AdminSection>
  );
}
