import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getSourceOnboardingReport } from "@/lib/diagnostics/source-onboarding";
import { AdminSection } from "../_sections/AdminSection";

export const dynamic = "force-dynamic";

/**
 * Source onboarding diagnostics.
 *
 * One row per configured ingestion source with every onboarding
 * facet, plus the four source-coverage warnings rolled up per
 * content type.
 */

const VERDICT_CLASS: Record<string, string> = {
  ready: "text-emerald-700",
  incomplete: "text-amber-700",
  blocked: "font-semibold text-red-700",
};

const WARNING_CLASS: Record<string, string> = {
  below_minimum: "border-amber-300 bg-amber-50 text-amber-900",
  validation_without_primary: "border-red-300 bg-red-50 text-red-900",
  primary_without_validation: "border-amber-300 bg-amber-50 text-amber-900",
  sources_without_builds: "border-amber-300 bg-amber-50 text-amber-900",
};

function cap(value: number | null): string {
  return value == null ? "—" : String(value);
}

export default async function SourceOnboardingPage() {
  const admin = await requireAdmin();
  if (!admin) {
    redirect("/admin/login");
  }
  const report = await getSourceOnboardingReport().catch(() => null);

  return (
    <AdminSection
      titleKey="admin.sourceOnboarding.title"
      subtitle={
        report
          ? `${report.sources.length} sources · ${report.ready} ready · ${report.incomplete} incomplete · ${report.blocked} blocked · ${report.warnings.length} coverage warning(s)`
          : "Source onboarding diagnostics unavailable"
      }
    >
      {!report ? (
        <div className="mx-auto max-w-6xl rounded-2xl border border-red-300 bg-red-50 p-4 font-mono text-xs text-red-800">
          The source onboarding report could not be generated.
        </div>
      ) : (
        <div className="mx-auto max-w-6xl space-y-6">
          {/* Coverage warnings. */}
          <section data-testid="source-coverage-warnings">
            <h2 className="font-display text-lg text-ink">Source coverage warnings</h2>
            {report.warnings.length === 0 ? (
              <p className="mt-2 rounded-2xl border border-emerald-300 bg-emerald-50 p-4 font-mono text-xs text-emerald-800">
                Every content type meets its source-coverage requirements.
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {report.warnings.map((w, i) => (
                  <li
                    key={`${w.contentType}-${w.kind}-${i}`}
                    className={`rounded-2xl border p-3 font-mono text-xs ${WARNING_CLASS[w.kind] ?? "border-ink/10"}`}
                    data-testid={`source-coverage-warning-${w.kind}`}
                  >
                    {w.message}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Per-source onboarding diagnostics. */}
          <section>
            <h2 className="font-display text-lg text-ink">Per-source onboarding</h2>
            <div className="mt-2 overflow-x-auto rounded-2xl border border-ink/10 bg-paper p-4">
              <table
                className="w-full border-collapse font-mono text-xs"
                data-testid="source-onboarding-table"
              >
                <thead>
                  <tr className="border-b border-ink/10 text-left text-ink-faint">
                    <th className="py-2 pr-3">Source</th>
                    <th className="py-2 pr-3">Verdict</th>
                    <th className="py-2 pr-3">Discovery</th>
                    <th className="py-2 pr-3">Role</th>
                    <th className="py-2 pr-3">Tier</th>
                    <th className="py-2 pr-3">Content types</th>
                    <th className="py-2 pr-3">License</th>
                    <th className="py-2 pr-3" title="fetch / build / daily caps">
                      Caps (f/b/d)
                    </th>
                    <th className="py-2 pr-3">Health</th>
                    <th className="py-2 pr-3">Issues</th>
                  </tr>
                </thead>
                <tbody>
                  {report.sources.map((s) => (
                    <tr
                      key={s.sourceId}
                      className="border-b border-ink/5 align-top"
                      data-testid={`source-onboarding-row-${s.host}`}
                    >
                      <td className="py-1 pr-3">
                        {s.name}
                        <span className="block text-ink-faint">{s.host}</span>
                      </td>
                      <td className={`py-1 pr-3 ${VERDICT_CLASS[s.verdict] ?? ""}`}>{s.verdict}</td>
                      <td className="py-1 pr-3">{s.discoveryMethod}</td>
                      <td className="py-1 pr-3">{s.role}</td>
                      <td className="py-1 pr-3 tabular-nums">{s.tier}</td>
                      <td className="py-1 pr-3 text-ink-soft">
                        {s.supportedContentTypes.length === 0
                          ? "—"
                          : s.supportedContentTypes.join(", ")}
                      </td>
                      <td className="py-1 pr-3 text-ink-soft">{s.licenseStatus}</td>
                      <td className="py-1 pr-3 tabular-nums">
                        {cap(s.fetchCap)}/{cap(s.buildCap)}/{cap(s.dailyCap)}
                      </td>
                      <td className="py-1 pr-3">{s.sourceHealth}</td>
                      <td className="py-1 pr-3 text-ink-soft">
                        {s.issues.length === 0 ? "ok" : s.issues.join(" ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </AdminSection>
  );
}
