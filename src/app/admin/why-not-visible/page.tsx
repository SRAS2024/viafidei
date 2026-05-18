import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { listNonPublicRows } from "@/lib/data/why-not-visible";
import { AdminSection } from "../_sections/AdminSection";

export const dynamic = "force-dynamic";

/**
 * Why-not-visible admin page.
 *
 * Lists rows that exist in the database but cannot be reached by
 * the public site. Each entry shows the 12 spec-listed fields:
 * content type, title, source URL, source host, build status,
 * missing build fields, QA status, QA errors, public render
 * readiness, threshold eligibility, source purpose permissions,
 * suggested automatic next action.
 */
export default async function WhyNotVisiblePage({
  searchParams,
}: {
  searchParams: Promise<{ contentType?: string }>;
}) {
  const admin = await requireAdmin();
  if (!admin) {
    redirect("/admin/login");
  }
  const sp = await searchParams;
  const allRows = await listNonPublicRows({
    filter: "all",
  }).catch(() => []);
  const rows = sp.contentType ? allRows.filter((r) => r.contentType === sp.contentType) : allRows;
  return (
    <AdminSection
      titleKey="admin.whyNotVisible.title"
      subtitle={`${rows.length} non-public rows — each explains why it cannot reach the public site`}
    >
      <div className="mx-auto max-w-6xl space-y-4" data-testid="why-not-visible-rows">
        {rows.length === 0 ? (
          <div className="rounded-2xl border border-ink/10 bg-paper p-6 text-center">
            <p className="font-serif text-ink-soft">
              Every catalog row is visible to the public site.
            </p>
          </div>
        ) : (
          rows.map((row) => (
            <div
              key={`${row.contentType}:${row.contentId}`}
              className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4"
              data-testid={`why-not-visible-row-${row.contentId}`}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-serif text-lg font-semibold text-amber-950">
                  {row.title}{" "}
                  <span className="font-mono text-xs text-amber-700">
                    ({row.contentType} · {row.slug})
                  </span>
                </h3>
                <span className="font-mono text-xs uppercase tracking-wider text-amber-700">
                  {row.status}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 font-mono text-xs text-amber-900 md:grid-cols-3">
                <div>
                  <span className="text-amber-700">sourceUrl:</span>{" "}
                  <span className="break-all">{row.sourceUrl ?? "—"}</span>
                </div>
                <div>
                  <span className="text-amber-700">sourceHost:</span> {row.sourceHost ?? "—"}
                </div>
                <div>
                  <span className="text-amber-700">publicRenderReady:</span>{" "}
                  {String(row.publicRenderReady)}
                </div>
                <div>
                  <span className="text-amber-700">isThresholdEligible:</span>{" "}
                  {String(row.isThresholdEligible)}
                </div>
                <div>
                  <span className="text-amber-700">build status:</span>{" "}
                  {row.lastBuildOutcome ?? "—"}
                </div>
                <div>
                  <span className="text-amber-700">QA status:</span>{" "}
                  {row.packageValidationStatus ?? "—"}
                </div>
              </div>
              {row.missingFields.length > 0 && (
                <p className="mt-2 font-serif text-sm text-amber-950">
                  <span className="text-amber-700">Missing build fields:</span>{" "}
                  {row.missingFields.join(", ")}
                </p>
              )}
              {row.packageValidationErrors.length > 0 && (
                <p className="mt-1 font-serif text-sm text-amber-950">
                  <span className="text-amber-700">QA errors:</span>{" "}
                  {row.packageValidationErrors.join("; ")}
                </p>
              )}
              {row.lastQaReason && (
                <p className="mt-1 font-serif text-sm text-amber-950">
                  <span className="text-amber-700">Last QA reason:</span> {row.lastQaReason}
                </p>
              )}
              <p className="mt-2 font-mono text-xs text-emerald-800">
                Suggested next action: <strong>{row.suggestedNextAction}</strong>
              </p>
            </div>
          ))
        )}
      </div>
    </AdminSection>
  );
}
