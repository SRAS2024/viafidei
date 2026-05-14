import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { AdminSection } from "../_sections/AdminSection";

export const dynamic = "force-dynamic";

const LOG_AREAS = [
  {
    href: "/admin/logs/accounts",
    eyebrow: "I.",
    title: "Account audit log",
    description:
      "Per-user account actions: edits to user records, profile changes, password resets, role changes — the existing admin audit table.",
  },
  {
    href: "/admin/logs/admin",
    eyebrow: "II.",
    title: "Admin actions",
    description:
      "Changes admins make across the site: homepage edits, content page edits, settings, diagnostics actions, data management toggles, and user account actions.",
  },
  {
    href: "/admin/logs/data-management",
    eyebrow: "III.",
    title: "Data Management",
    description:
      "Additions, updates, deletions, rejections, archives, dedupes, and category corrections performed by the Ingestion & Data Management system — with the reason and whether it was automatic or admin-triggered.",
  },
] as const;

export default async function AdminLogsHub() {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");
  const [accountLogCount, dataManagementLogCount] = await Promise.all([
    prisma.adminAuditLog.count().catch(() => 0),
    prisma.dataManagementLog.count().catch(() => 0),
  ]);

  return (
    <AdminSection
      titleKey="admin.card.logs"
      subtitle="One hub for every log the Via Fidei admin can review. Each section opens its own dedicated page with consistent formatting and filtering."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {LOG_AREAS.map((area) => {
          const count =
            area.href.endsWith("/data-management")
              ? dataManagementLogCount
              : accountLogCount;
          return (
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
              <p className="vf-nav-link mt-4 text-sm">
                {count > 0 ? `Open · ${count.toLocaleString()} entries →` : "Open →"}
              </p>
            </Link>
          );
        })}
      </div>
    </AdminSection>
  );
}
