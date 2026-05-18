import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { runCanaryBuilds } from "@/lib/content-factory";
import { AdminSection } from "../_sections/AdminSection";

export const dynamic = "force-dynamic";

/**
 * Admin canary results page.
 *
 * Runs the bundled canary fixtures through the real builder code on
 * every page load (no DB writes). When a canary fails, the content
 * factory is unhealthy and the admin sees the failure here before
 * production traffic does.
 */
export default async function CanaryResultsPage() {
  const admin = await requireAdmin();
  if (!admin) {
    redirect("/admin/login");
  }
  const report = runCanaryBuilds();
  const failingCount = report.results.filter((r) => !r.passed).length;
  return (
    <AdminSection
      titleKey="admin.canaryResults.title"
      subtitle={`Generated ${report.generatedAt.toISOString()} · ${report.results.length} fixtures · ${failingCount} failing`}
    >
      <div className="mx-auto max-w-3xl space-y-3" data-testid="canary-results">
        <div
          className={`rounded-2xl border px-5 py-4 ${
            report.factoryHealthy ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"
          }`}
          data-testid="canary-results-summary"
        >
          <h2
            className={`font-serif text-lg font-semibold ${
              report.factoryHealthy ? "text-emerald-900" : "text-red-900"
            }`}
          >
            {report.factoryHealthy ? "Content factory healthy" : "Content factory unhealthy"}
          </h2>
          <p
            className={`mt-1 font-serif text-sm ${
              report.factoryHealthy ? "text-emerald-800" : "text-red-800"
            }`}
          >
            {report.factoryHealthy
              ? "Every canary fixture builds a complete package."
              : "One or more canary fixtures regressed. The content factory cannot accept new content until this is fixed."}
          </p>
        </div>
        {report.results.map((r) => (
          <div
            key={`${r.contentType}:${r.fixtureName}`}
            className={`rounded-2xl border px-5 py-4 ${
              r.passed ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"
            }`}
            data-testid={`canary-row-${r.contentType}-${r.fixtureName.replace(/\s+/g, "-")}`}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-serif font-semibold">
                {r.contentType} <span className="text-ink-soft">·</span> {r.fixtureName}
              </h3>
              <span
                className={`font-mono text-xs uppercase tracking-wider ${
                  r.passed ? "text-emerald-700" : "text-red-700"
                }`}
              >
                {r.passed ? "PASS" : "FAIL"}
              </span>
            </div>
            <p className="mt-1 font-mono text-xs">
              outcome: <strong>{r.outcome}</strong>
            </p>
            {r.failureReason && (
              <p className="mt-1 font-serif text-sm text-red-900">{r.failureReason}</p>
            )}
            {r.missingFields && r.missingFields.length > 0 && (
              <p className="mt-1 font-mono text-xs text-red-900">
                Missing: {r.missingFields.join(", ")}
              </p>
            )}
          </div>
        ))}
      </div>
    </AdminSection>
  );
}
