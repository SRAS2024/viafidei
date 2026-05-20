import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getProductionRunbook } from "@/lib/diagnostics/production-runbook";
import { AdminSection } from "../_sections/AdminSection";

export const dynamic = "force-dynamic";

/**
 * Production growth runbook.
 *
 * The single operator page for "what is wrong with content growth
 * and what is the system doing about it" — stalled content types,
 * paused / promoted sources, weak builders, missing validation
 * evidence, and failing public display checks.
 */
export default async function ProductionRunbookPage() {
  const admin = await requireAdmin();
  if (!admin) {
    redirect("/admin/login");
  }
  const runbook = await getProductionRunbook().catch(() => null);

  if (!runbook) {
    return (
      <AdminSection titleKey="admin.productionRunbook.title" subtitle="Runbook unavailable">
        <div className="mx-auto max-w-5xl rounded-2xl border border-red-300 bg-red-50 p-4 font-mono text-xs text-red-800">
          The production growth runbook could not be generated.
        </div>
      </AdminSection>
    );
  }

  const sectionCount =
    runbook.stalledContentTypes.length +
    runbook.pausedSources.length +
    runbook.weakBuilders.length +
    runbook.missingValidationEvidence.length +
    runbook.failingPublicDisplay.length;

  return (
    <AdminSection
      titleKey="admin.productionRunbook.title"
      subtitle={
        sectionCount === 0
          ? "No stalls, paused sources, weak builders or display failures detected."
          : `${runbook.stalledContentTypes.length} stalled · ${runbook.pausedSources.length} paused sources · ${runbook.weakBuilders.length} weak builders · ${runbook.failingPublicDisplay.length} display failures`
      }
    >
      <div className="mx-auto max-w-5xl space-y-5">
        {/* Stalled content types + next action. */}
        <section
          className="rounded-2xl border border-ink/10 bg-paper p-5"
          data-testid="runbook-stalled"
        >
          <h2 className="font-display text-lg text-ink">Stalled content types</h2>
          {runbook.stalledContentTypes.length === 0 ? (
            <p className="mt-2 font-serif text-sm text-ink-soft">No content type is stalled.</p>
          ) : (
            <table className="mt-3 w-full font-mono text-xs">
              <thead className="text-left text-ink-faint">
                <tr>
                  <th className="py-1 pr-3">Content type</th>
                  <th className="py-1 pr-3">Why it is stalled</th>
                  <th className="py-1 pr-3">Automatic next action</th>
                </tr>
              </thead>
              <tbody>
                {runbook.stalledContentTypes.map((s) => (
                  <tr key={s.contentType} className="border-t border-ink/5">
                    <td className="py-1 pr-3">{s.contentType}</td>
                    <td className="py-1 pr-3 text-amber-800">{s.stallReason}</td>
                    <td className="py-1 pr-3 text-ink-soft">{s.nextAction}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* Failing public display checks. */}
        <section
          className="rounded-2xl border border-ink/10 bg-paper p-5"
          data-testid="runbook-display-failures"
        >
          <h2 className="font-display text-lg text-ink">Public display checks failing</h2>
          {runbook.failingPublicDisplay.length === 0 ? (
            <p className="mt-2 font-serif text-sm text-ink-soft">
              Every persisted package is reaching public display.
            </p>
          ) : (
            <ul className="mt-2 space-y-1 font-mono text-xs">
              {runbook.failingPublicDisplay.map((d) => (
                <li key={d.contentType} className="text-red-800">
                  {d.contentType}: {d.persisted} persisted but only {d.public} public
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Weak builders. */}
        <section
          className="rounded-2xl border border-ink/10 bg-paper p-5"
          data-testid="runbook-weak-builders"
        >
          <h2 className="font-display text-lg text-ink">Weak builders</h2>
          {runbook.weakBuilders.length === 0 ? (
            <p className="mt-2 font-serif text-sm text-ink-soft">No repeated builder weakness.</p>
          ) : (
            <ul className="mt-2 space-y-1 font-serif text-sm text-ink-soft">
              {runbook.weakBuilders.map((w) => (
                <li key={`${w.builderName}-${w.missingField}`}>
                  <span className="font-mono text-xs text-red-700">×{w.failureCount}</span>{" "}
                  {w.message}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Missing validation evidence. */}
        <section
          className="rounded-2xl border border-ink/10 bg-paper p-5"
          data-testid="runbook-missing-evidence"
        >
          <h2 className="font-display text-lg text-ink">Missing validation evidence</h2>
          {runbook.missingValidationEvidence.length === 0 ? (
            <p className="mt-2 font-serif text-sm text-ink-soft">
              No content type is short of cross-source validation evidence.
            </p>
          ) : (
            <ul className="mt-2 space-y-1 font-mono text-xs">
              {runbook.missingValidationEvidence.map((g) => (
                <li key={g.contentType} className="text-amber-800">
                  {g.contentType}: {g.insufficient} insufficient-evidence result(s)
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Paused + promoted sources. */}
        <div className="grid gap-5 md:grid-cols-2">
          <section
            className="rounded-2xl border border-ink/10 bg-paper p-5"
            data-testid="runbook-paused-sources"
          >
            <h2 className="font-display text-lg text-ink">Paused sources</h2>
            {runbook.pausedSources.length === 0 ? (
              <p className="mt-2 font-serif text-sm text-ink-soft">No source is paused.</p>
            ) : (
              <ul className="mt-2 space-y-1 font-mono text-xs">
                {runbook.pausedSources.map((s) => (
                  <li key={s.host}>
                    <span className="text-ink">{s.host}</span>{" "}
                    <span className="text-ink-soft">— {s.reason}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section
            className="rounded-2xl border border-ink/10 bg-paper p-5"
            data-testid="runbook-promoted-sources"
          >
            <h2 className="font-display text-lg text-ink">Promoted sources</h2>
            {runbook.promotedSources.length === 0 ? (
              <p className="mt-2 font-serif text-sm text-ink-soft">
                No source has had its role changed.
              </p>
            ) : (
              <ul className="mt-2 space-y-1 font-mono text-xs">
                {runbook.promotedSources.map((s) => (
                  <li key={s.host}>
                    <span className="text-ink">{s.host}</span>{" "}
                    <span className="text-ink-soft">
                      → {s.role} ({s.reason})
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </AdminSection>
  );
}
