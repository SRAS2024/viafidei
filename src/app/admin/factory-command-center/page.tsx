import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getFactoryCommandCenter } from "@/lib/diagnostics/factory-command-center";
import { AdminSection } from "../_sections/AdminSection";

export const dynamic = "force-dynamic";

/**
 * Content factory command center (spec §22).
 *
 * One page, one report — every spec-listed factory metric rendered
 * as a card. The page intentionally avoids tab-switching so an
 * operator can scan the whole system in a single eye-track.
 */
export default async function FactoryCommandCenterPage() {
  const admin = await requireAdmin();
  if (!admin) {
    redirect("/admin/login");
  }
  const report = await getFactoryCommandCenter();

  return (
    <AdminSection
      titleKey="admin.factoryCommandCenter.title"
      subtitle={`Generated ${report.generatedAt.toISOString()} · ${report.lookBackHours}h look-back · ${report.sections.length} sections`}
    >
      <div
        className="mx-auto grid max-w-6xl grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
        data-testid="factory-command-center-grid"
      >
        {report.sections.map((section) => (
          <div
            key={section.key}
            className="rounded-2xl border border-ink/10 bg-paper px-5 py-4"
            data-testid={`factory-command-center-${section.key}`}
          >
            <p className="font-mono text-xs uppercase tracking-wider text-ink-soft">
              {section.label}
            </p>
            <p className="mt-1 font-display text-2xl text-ink">{section.value ?? "—"}</p>
            <p className="font-serif text-xs text-ink-soft">{section.metric}</p>
            {section.details && (
              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-xs text-ink-soft">
                {Object.entries(section.details).map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-ink-faint">{k.replace(/_/g, " ")}</dt>
                    <dd>{v ?? "—"}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        ))}
      </div>
    </AdminSection>
  );
}
