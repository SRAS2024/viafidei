import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getValidationEvidenceSummary } from "@/lib/data/validation-evidence";
import { AdminSection } from "../_sections/AdminSection";

export const dynamic = "force-dynamic";

const DECISION_STYLES: Record<string, string> = {
  pass: "text-emerald-700",
  fail: "text-red-800",
  insufficient_evidence: "text-amber-800",
};

/**
 * Admin "Validation evidence" page.
 *
 * Surfaces ContentValidationEvidence rows so an admin can answer
 * "why did the cross-source validator pass/fail this package?".
 * Shows totals, per-content-type breakdown, and the most recent 50
 * rows by default.
 */
export default async function ValidationEvidencePage({
  searchParams,
}: {
  searchParams?: Promise<{ contentType?: string }>;
}) {
  const admin = await requireAdmin();
  if (!admin) {
    redirect("/admin/login");
  }
  const params = (await searchParams) ?? {};
  const contentType = params.contentType ?? null;
  const summary = await getValidationEvidenceSummary({ contentType });

  return (
    <AdminSection
      titleKey="admin.validationEvidence.title"
      subtitle={`${summary.totalRows} total evidence rows · ${summary.totalPass} pass · ${summary.totalFail} fail · ${summary.totalInsufficient} insufficient`}
    >
      <div
        className="mx-auto mb-6 grid max-w-6xl grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4"
        data-testid="validation-evidence-totals"
      >
        <div className="rounded-2xl border border-ink/10 bg-paper px-5 py-4">
          <p className="font-mono text-xs uppercase text-ink-soft">total rows</p>
          <p className="font-display text-3xl">{summary.totalRows}</p>
        </div>
        <div className="rounded-2xl border border-emerald-300 bg-emerald-50 px-5 py-4">
          <p className="font-mono text-xs uppercase text-emerald-700">pass</p>
          <p className="font-display text-3xl text-emerald-900">{summary.totalPass}</p>
        </div>
        <div className="rounded-2xl border border-red-300 bg-red-50 px-5 py-4">
          <p className="font-mono text-xs uppercase text-red-700">fail</p>
          <p className="font-display text-3xl text-red-900">{summary.totalFail}</p>
        </div>
        <div className="rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4">
          <p className="font-mono text-xs uppercase text-amber-700">insufficient</p>
          <p className="font-display text-3xl text-amber-900">{summary.totalInsufficient}</p>
        </div>
      </div>

      <div
        className="mx-auto mb-6 max-w-6xl rounded-2xl border border-ink/10 bg-paper px-5 py-4"
        data-testid="validation-evidence-by-content-type"
      >
        <h2 className="font-serif text-base font-semibold">By content type</h2>
        {summary.byContentType.length === 0 ? (
          <p className="mt-2 font-serif text-sm text-ink-soft">
            No validation evidence has been written yet — the worker has not run cross-source
            validation against any approved validators.
          </p>
        ) : (
          <table className="mt-3 w-full font-mono text-xs">
            <thead className="text-ink-soft">
              <tr className="text-left">
                <th className="py-1">Content type</th>
                <th className="py-1">Pass</th>
                <th className="py-1">Fail</th>
                <th className="py-1">Insufficient</th>
              </tr>
            </thead>
            <tbody>
              {summary.byContentType.map((row) => (
                <tr
                  key={row.contentType}
                  className="border-t border-ink/5"
                  data-testid={`validation-evidence-content-type-${row.contentType}`}
                >
                  <td className="py-1">
                    <a
                      href={`/admin/validation-evidence?contentType=${row.contentType}`}
                      className="vf-nav-link"
                    >
                      {row.contentType}
                    </a>
                  </td>
                  <td className="py-1 text-emerald-700">{row.pass}</td>
                  <td className="py-1 text-red-800">{row.fail}</td>
                  <td className="py-1 text-amber-800">{row.insufficient}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="mx-auto max-w-6xl rounded-2xl border border-ink/10 bg-paper px-5 py-4">
        <h2 className="font-serif text-base font-semibold">
          {contentType ? `Recent evidence — ${contentType}` : "Recent evidence (all types)"}
        </h2>
        {summary.recent.length === 0 ? (
          <p
            className="mt-2 font-serif text-sm text-ink-soft"
            data-testid="validation-evidence-empty"
          >
            No evidence rows match the current filter.
          </p>
        ) : (
          <ul className="mt-3 space-y-2" data-testid="validation-evidence-list">
            {summary.recent.map((row) => (
              <li
                key={row.id}
                className="rounded-xl border border-ink/5 px-3 py-2 font-mono text-xs"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span>
                    <strong className="font-semibold text-ink">{row.contentType}</strong> ·{" "}
                    {row.fieldName} ·{" "}
                    <span className={DECISION_STYLES[row.validationDecision] ?? ""}>
                      {row.validationDecision}
                    </span>
                  </span>
                  <span className="text-ink-soft">{row.createdAt.toISOString()}</span>
                </div>
                <div className="mt-1 text-ink-soft">
                  <span className="text-ink-faint">type:</span> {row.evidenceType} ·{" "}
                  <span className="text-ink-faint">source:</span>{" "}
                  <a href={row.sourceUrl} className="vf-nav-link" rel="noreferrer noopener">
                    {row.sourceHost}
                  </a>{" "}
                  · <span className="text-ink-faint">confidence:</span>{" "}
                  {row.matchConfidence.toFixed(2)}
                </div>
                {row.reason && <p className="mt-1 font-serif text-ink-soft">{row.reason}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </AdminSection>
  );
}
