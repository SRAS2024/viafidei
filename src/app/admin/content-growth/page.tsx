import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getContentGrowthDashboard } from "@/lib/data/content-growth-dashboard";
import { getGlobalGrowthHealth } from "@/lib/data/growth-health-score";
import { getSevenDayGrowthReport } from "@/lib/data/seven-day-growth-report";
import type { SevenDayGrowthRow } from "@/lib/data/seven-day-growth-report";
import {
  getSourceDocumentSummary,
  type SourceDocumentSummary,
} from "@/lib/data/source-document-summary";
import { DailySeriesChart } from "@/components/diagnostics/DailySeriesChart";
import { AdminSection } from "../_sections/AdminSection";

export const dynamic = "force-dynamic";

/**
 * Content growth command center.
 *
 * Leads with the seven-day production content growth report — per
 * content type, the source → public pipeline metrics over a rolling
 * week, daily growth targets, 24h / 7d growth warnings, a production
 * growth score, and four daily-trend charts. The all-time pipeline
 * table follows underneath.
 */

function scoreClass(score: number): string {
  if (score >= 80) return "text-emerald-700";
  if (score >= 50) return "text-amber-700";
  return "text-red-700";
}

function MetricCell({ value }: { value: number | null }) {
  if (value == null) {
    return (
      <span className="text-red-600" title="this metric's query failed — see the errors row">
        err
      </span>
    );
  }
  return <span className="tabular-nums">{value}</span>;
}

const SEVEN_DAY_COLUMNS: ReadonlyArray<{ label: string; title: string }> = [
  { label: "Docs", title: "Source documents fetched" },
  { label: "Builds", title: "Build attempts" },
  { label: "Complete", title: "Complete packages built" },
  { label: "X-valid", title: "Cross-source validation passes" },
  { label: "QA pass", title: "Strict QA passes" },
  { label: "Persisted", title: "Persisted packages" },
  { label: "Public", title: "Public packages" },
  { label: "Search", title: "Search-visible packages" },
  { label: "Sitemap", title: "Sitemap-visible packages" },
  { label: "Deleted", title: "Deleted invalid packages" },
  { label: "Dup", title: "Duplicate packages" },
  { label: "Net", title: "Net public growth (public created − deleted invalid)" },
];

function sevenDayMetricValues(row: SevenDayGrowthRow): ReadonlyArray<number | null> {
  const m = row.metrics;
  return [
    m.sourceDocumentsFetched,
    m.buildAttempts,
    m.completePackagesBuilt,
    m.crossSourceValidationPasses,
    m.strictQaPasses,
    m.persistedPackages,
    m.publicPackages,
    m.searchVisiblePackages,
    m.sitemapVisiblePackages,
    m.deletedInvalidPackages,
    m.duplicatePackages,
    m.netPublicGrowth,
  ];
}

/**
 * Source documents are counted directly from the SourceDocument
 * table — never inferred from ContentPackageBuildLog.
 */
function SourceDocumentSection({ summary }: { summary: SourceDocumentSummary | null }) {
  if (!summary) {
    return (
      <section className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4">
        <p className="font-serif text-sm text-red-800">Source document summary unavailable.</p>
      </section>
    );
  }
  const rows: ReadonlyArray<[string, number | null]> = [
    ["Source documents created", summary.sourceDocumentsCreated],
    ["Created in last 24h", summary.sourceDocumentsCreated24h],
    ["Waiting for build", summary.sourceDocumentsWaitingForBuild],
    ["With build attempts", summary.sourceDocumentsWithBuildAttempts],
    ["Without build attempt", summary.sourceDocumentsWithoutBuildAttempt],
    ["Source fetch succeeded", summary.sourceFetchSucceeded],
    ["Source fetch failed", summary.sourceFetchFailed],
  ];
  return (
    <section
      className="rounded-2xl border border-ink/10 bg-paper px-5 py-4"
      data-testid="source-document-summary"
    >
      <h2 className="font-serif text-lg font-semibold">Source documents</h2>
      {summary.summaryMessage ? (
        <p className="mt-1 font-serif text-sm text-amber-800">{summary.summaryMessage}</p>
      ) : null}
      <table className="mt-3 w-full border-collapse font-mono text-xs">
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label} className="border-b border-ink/10">
              <td className="py-1 pr-3 text-ink-soft">{label}</td>
              <td className="py-1 tabular-nums">{value == null ? "err" : value}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 font-mono text-xs text-ink-faint">
        source: SourceDocument — counted directly, not inferred from build logs
      </p>
    </section>
  );
}

export default async function ContentGrowthPage() {
  const admin = await requireAdmin();
  if (!admin) {
    redirect("/admin/login");
  }
  const [rows, health, report, sourceDocs] = await Promise.all([
    getContentGrowthDashboard().catch(() => []),
    getGlobalGrowthHealth().catch(() => null),
    getSevenDayGrowthReport().catch(() => null),
    getSourceDocumentSummary().catch(() => null),
  ]);

  const warning7d = report?.rows.filter((r) => r.warning === "no_growth_7d") ?? [];
  const warning24h = report?.rows.filter((r) => r.warning === "no_growth_24h") ?? [];
  const penalisedRows = report?.rows.filter((r) => r.scorePenalties.length > 0) ?? [];

  return (
    <AdminSection
      titleKey="admin.contentGrowth.title"
      subtitle={
        report
          ? `Seven-day production growth score: ${report.overallGrowthScore}/100  ·  ${report.warningCount} content type(s) with a growth warning  ·  generated ${report.generatedAt.toISOString()}`
          : "Seven-day production growth report unavailable"
      }
    >
      <div className="mx-auto max-w-6xl space-y-10">
        <SourceDocumentSection summary={sourceDocs} />
        {/* ============ Seven-day production content growth report ============ */}
        {report ? (
          <section className="space-y-6" data-testid="seven-day-growth-report">
            {/* Growth warnings. */}
            {warning7d.length === 0 && warning24h.length === 0 ? (
              <div
                className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4 font-mono text-xs text-emerald-800"
                data-testid="seven-day-warnings-none"
              >
                Every content type produced valid public package growth in the last 24 hours.
              </div>
            ) : (
              <div className="space-y-3">
                {warning7d.length > 0 ? (
                  <div
                    className="rounded-2xl border border-red-300 bg-red-50 p-4"
                    data-testid="seven-day-warning-7d"
                  >
                    <p className="font-mono text-xs font-semibold uppercase tracking-wide text-red-800">
                      No valid public package growth in the last 7 days
                    </p>
                    <p className="mt-1 font-serif text-sm text-red-900">
                      Stalled content types:{" "}
                      <span className="font-semibold">
                        {warning7d.map((r) => r.contentType).join(", ")}
                      </span>
                    </p>
                  </div>
                ) : null}
                {warning24h.length > 0 ? (
                  <div
                    className="rounded-2xl border border-amber-300 bg-amber-50 p-4"
                    data-testid="seven-day-warning-24h"
                  >
                    <p className="font-mono text-xs font-semibold uppercase tracking-wide text-amber-800">
                      No valid public package growth in the last 24 hours
                    </p>
                    <p className="mt-1 font-serif text-sm text-amber-900">
                      Content types:{" "}
                      <span className="font-semibold">
                        {warning24h.map((r) => r.contentType).join(", ")}
                      </span>
                    </p>
                  </div>
                ) : null}
              </div>
            )}

            {/* Per-content-type metrics table. */}
            <div
              className="overflow-x-auto rounded-2xl border border-ink/10 bg-paper p-4"
              data-testid="seven-day-growth-table-wrap"
            >
              <table
                className="w-full border-collapse font-mono text-xs"
                data-testid="seven-day-growth-table"
              >
                <thead>
                  <tr className="border-b border-ink/10 text-left text-ink-faint">
                    <th className="py-2 pr-3">Content type</th>
                    <th className="py-2 pr-3" title="Production content growth score (0–100)">
                      Score
                    </th>
                    {SEVEN_DAY_COLUMNS.map((c) => (
                      <th key={c.label} className="py-2 pr-3" title={c.title}>
                        {c.label}
                      </th>
                    ))}
                    <th className="py-2 pr-3" title="Seven-day growth target (daily target × 7)">
                      7d target
                    </th>
                    <th
                      className="py-2 pr-3"
                      title="Strict-public packages created in the last 24h"
                    >
                      24h
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {report.rows.map((r) => (
                    <tr
                      key={r.contentType}
                      className="border-b border-ink/5"
                      data-testid={`seven-day-row-${r.contentType}`}
                    >
                      <td className="py-1 pr-3">
                        {r.contentType}
                        {r.warning === "no_growth_7d" ? (
                          <span className="ml-1 text-red-600" title={r.warningMessage}>
                            ●
                          </span>
                        ) : r.warning === "no_growth_24h" ? (
                          <span className="ml-1 text-amber-600" title={r.warningMessage}>
                            ●
                          </span>
                        ) : null}
                      </td>
                      <td className={`py-1 pr-3 font-semibold ${scoreClass(r.growthScore)}`}>
                        {r.growthScore}
                      </td>
                      {sevenDayMetricValues(r).map((value, i) => (
                        <td key={i} className="py-1 pr-3">
                          <MetricCell value={value} />
                        </td>
                      ))}
                      <td className="py-1 pr-3">
                        <span className={r.metTarget ? "text-emerald-700" : "text-ink-soft"}>
                          {r.metrics.publicPackages ?? "—"}/{r.sevenDayTarget}
                        </span>
                      </td>
                      <td className="py-1 pr-3">
                        <MetricCell value={r.publicGrowth24h} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-3 font-mono text-[11px] text-ink-faint">
                Score is grounded in real public packages created — not raw rows. A content type
                with build activity but no public output cascades through the persistence, display,
                search and sitemap penalties toward zero.
              </p>
            </div>

            {/* Growth score breakdown. */}
            {penalisedRows.length > 0 ? (
              <div
                className="rounded-2xl border border-ink/10 bg-paper p-4"
                data-testid="seven-day-score-breakdown"
              >
                <h3 className="font-display text-lg text-ink">Why growth scores are reduced</h3>
                <div className="mt-3 space-y-3">
                  {penalisedRows.map((r) => (
                    <div key={r.contentType} data-testid={`seven-day-penalties-${r.contentType}`}>
                      <p className="font-mono text-xs">
                        <span className="font-semibold">{r.contentType}</span>{" "}
                        <span className={scoreClass(r.growthScore)}>{r.growthScore}/100</span>
                      </p>
                      <ul className="mt-1 space-y-0.5 font-serif text-sm text-ink-soft">
                        {r.scorePenalties.map((p) => (
                          <li key={p.id}>
                            <span className="font-mono text-xs text-red-700">−{p.amount}</span>{" "}
                            {p.reason}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Daily-trend charts. */}
            <div className="grid gap-4 xl:grid-cols-2" data-testid="seven-day-charts">
              <DailySeriesChart
                chart={report.charts.dailyPublicGrowthByType}
                testId="chart-public-growth"
              />
              <DailySeriesChart
                chart={report.charts.dailyQaPassRateByType}
                testId="chart-qa-pass-rate"
              />
              <DailySeriesChart
                chart={report.charts.dailySourceSuccessRateBySource}
                testId="chart-source-success"
              />
              <DailySeriesChart
                chart={report.charts.dailyBuilderSuccessRateByBuilder}
                testId="chart-builder-success"
              />
            </div>
          </section>
        ) : (
          <div
            className="rounded-2xl border border-red-300 bg-red-50 p-4 font-mono text-xs text-red-800"
            data-testid="seven-day-growth-error"
          >
            The seven-day production content growth report could not be generated.
          </div>
        )}

        {/* ===================== All-time pipeline ===================== */}
        <section className="space-y-3">
          <h2 className="font-display text-2xl text-ink">All-time pipeline</h2>
          <p className="font-serif text-sm text-ink-soft">
            Lifetime totals per content type.{" "}
            {health
              ? `Global growth health score: ${health.globalScore}/100.`
              : "Growth health unavailable."}
          </p>
          <div
            className="overflow-x-auto rounded-2xl border border-ink/10 bg-paper p-4"
            data-testid="content-growth-table-wrap"
          >
            <table
              className="w-full border-collapse font-mono text-xs"
              data-testid="content-growth-table"
            >
              <thead>
                <tr className="border-b border-ink/10 text-left text-ink-faint">
                  <th className="py-2 pr-2">Content type</th>
                  <th className="py-2 pr-2">Docs</th>
                  <th className="py-2 pr-2">Builds</th>
                  <th className="py-2 pr-2">Complete</th>
                  <th className="py-2 pr-2">QA pass</th>
                  <th className="py-2 pr-2">Public</th>
                  <th className="py-2 pr-2">Threshold</th>
                  <th className="py-2 pr-2">24h</th>
                  <th className="py-2 pr-2">Stall reason</th>
                  <th className="py-2 pr-2">Updated</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const matchingHealth = health?.perType.find(
                    (p) => p.contentType === r.contentType,
                  );
                  return (
                    <tr
                      key={r.contentType}
                      className="border-b border-ink/5"
                      data-testid={`content-growth-row-${r.contentType}`}
                    >
                      <td className="py-1 pr-2">
                        {r.contentType}
                        {matchingHealth && (
                          <span
                            className="ml-2 text-ink-soft"
                            data-testid={`content-growth-score-${r.contentType}`}
                          >
                            ({matchingHealth.score}/100)
                          </span>
                        )}
                      </td>
                      <td className="py-1 pr-2">{r.sourceDocumentsFetched ?? "—"}</td>
                      <td className="py-1 pr-2">{r.buildAttempts ?? "—"}</td>
                      <td className="py-1 pr-2">{r.completePackagesBuilt ?? "—"}</td>
                      <td className="py-1 pr-2">{r.qaPassCount ?? "—"}</td>
                      <td className="py-1 pr-2">{r.publicPackageCount ?? "—"}</td>
                      <td className="py-1 pr-2">{r.thresholdEligibleCount ?? "—"}</td>
                      <td className="py-1 pr-2">{r.growthRate24h ?? "—"}</td>
                      <td className="py-1 pr-2">{r.currentStallReason || "ok"}</td>
                      <td className="py-1 pr-2 text-ink-faint">{r.lastUpdatedAt.toISOString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AdminSection>
  );
}
