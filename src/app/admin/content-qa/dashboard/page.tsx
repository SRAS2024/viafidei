import { redirect } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import {
  getContentQADashboard,
  getCleanupHealth,
  resolveCleanupPolicy,
  describeCleanupPolicy,
} from "@/lib/content-qa";
import { getAdminDataSourceCard } from "@/lib/diagnostics";
import { AdminSection } from "../../_sections/AdminSection";
import { StrictCleanupButton } from "./StrictCleanupButton";

export const dynamic = "force-dynamic";

/**
 * Strict Content QA dashboard. Shows valid / public / threshold-eligible
 * / rejected / deleted / review / removed-from-public-view counts per
 * content type, plus the per-bucket failure breakdown.
 *
 * Also surfaces the active cleanup policy (mode + deleteAllInvalid +
 * package contract version + last-run timestamp + stale flag) and the
 * Data Management Health panel.
 *
 * Read-only — the rejected log and the audit pipeline make every
 * decision automatically; this page exists so the operator can verify
 * the system is doing the right thing. If a metric query fails it
 * surfaces a diagnostic error per card instead of returning a fake
 * zero.
 */
export default async function ContentQADashboardPage() {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");

  const policy = resolveCleanupPolicy();
  const [rows, dataSourceCard, cleanupHealth] = await Promise.all([
    getContentQADashboard().catch(() => []),
    getAdminDataSourceCard()
      .then((c) => c)
      .catch(() => null as Awaited<ReturnType<typeof getAdminDataSourceCard>> | null),
    getCleanupHealth().catch((err) => {
      return {
        mode: policy.mode,
        deleteAllInvalid: policy.deleteAllInvalid,
        autoTriggerAfterIngestion: policy.autoTriggerAfterIngestion,
        packageContractVersion: policy.packageContractVersion,
        lastRunAt: null,
        msSinceLastRun: null,
        isStale: true,
        invalidPublicRowCount: 0,
        deletedLast24h: 0,
        deletedLast7d: 0,
        invalidPublicByContentType: {},
        deletedByCategoryLast24h: {},
        queryHealth: {
          dashboard: {
            ok: false,
            errorMessage: err instanceof Error ? err.message : String(err),
          },
        },
      };
    }),
  ]);

  const failingQueries = Object.entries(cleanupHealth.queryHealth).filter(([, v]) => !v.ok);
  const lastUpdated = new Date().toISOString();

  return (
    <AdminSection
      titleKey="admin.contentQA.title"
      subtitle="Strict content QA — package validation outcomes per content type."
    >
      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="vf-card rounded-sm p-4">
          <p className="vf-eyebrow">Cleanup policy</p>
          <p className="mt-1 font-display text-lg">{describeCleanupPolicy(policy)}</p>
          <p className="mt-2 font-serif text-xs text-ink-faint">
            Mode: {cleanupHealth.mode} · deleteAllInvalid:{" "}
            {cleanupHealth.deleteAllInvalid ? "true" : "false"} · contract:{" "}
            {cleanupHealth.packageContractVersion}
          </p>
        </div>
        <div className="vf-card rounded-sm p-4">
          <p className="vf-eyebrow">Last cleanup run</p>
          <p className="mt-1 font-display text-lg">
            {cleanupHealth.lastRunAt
              ? new Date(cleanupHealth.lastRunAt).toISOString().slice(0, 16)
              : "never"}
          </p>
          <p
            className={
              "mt-2 font-serif text-xs " +
              (cleanupHealth.isStale ? "text-red-700" : "text-emerald-700")
            }
          >
            {cleanupHealth.isStale ? "Stale — run cleanup soon." : "Fresh"}
          </p>
        </div>
        <div className="vf-card rounded-sm p-4">
          <p className="vf-eyebrow">Invalid public rows</p>
          <p
            className={
              "mt-1 font-display text-3xl " +
              (cleanupHealth.invalidPublicRowCount > 0 ? "text-red-700" : "text-emerald-700")
            }
          >
            {cleanupHealth.invalidPublicRowCount.toLocaleString()}
          </p>
          <p className="mt-2 font-serif text-xs text-ink-faint">
            Status=PUBLISHED but publicRenderReady=false. Target: 0.
          </p>
        </div>
        <div className="vf-card rounded-sm p-4">
          <p className="vf-eyebrow">Invalid deleted (24h / 7d)</p>
          <p className="mt-1 font-display text-3xl">
            {cleanupHealth.deletedLast24h.toLocaleString()}
            <span className="font-serif text-base text-ink-soft">
              {" "}
              / {cleanupHealth.deletedLast7d.toLocaleString()}
            </span>
          </p>
          <p className="mt-2 font-serif text-xs text-ink-faint">
            Rows removed by strict QA in the last day / week.
          </p>
        </div>
      </section>

      {dataSourceCard ? (
        <section className="mt-6 vf-card rounded-sm p-4">
          <p className="vf-eyebrow">Data sources wired to this dashboard</p>
          <p
            className={
              "mt-1 font-display text-sm " +
              (dataSourceCard.allReachable ? "text-emerald-700" : "text-red-700")
            }
          >
            {dataSourceCard.allReachable
              ? "All required tables reachable. Zero means real zero."
              : "One or more tables unreachable — dashboard zeros may be unreliable."}
          </p>
          <ul className="mt-3 grid gap-1 font-mono text-xs text-ink-soft sm:grid-cols-2 lg:grid-cols-3">
            {dataSourceCard.surfaces.map((s) => (
              <li
                key={s.key}
                className={s.present ? "text-emerald-700" : "text-red-700"}
                title={s.errorMessage}
              >
                {s.present ? "✓" : "✗"} {s.label} ({s.rowCount.toLocaleString()} rows)
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {failingQueries.length > 0 ? (
        <section className="mt-6 vf-card rounded-sm border-l-4 border-red-700 bg-red-50 p-4">
          <p className="font-display text-lg text-red-900">
            {failingQueries.length} dashboard quer
            {failingQueries.length === 1 ? "y" : "ies"} returned an error
          </p>
          <p className="mt-1 font-serif text-sm text-red-900">
            Zero in the cards below means real zero, not a failed query — but the queries listed
            here did not return data. Investigate the error before trusting the cleanup counts.
          </p>
          <ul className="mt-2 font-mono text-xs text-red-900">
            {failingQueries.map(([key, value]) => (
              <li key={key}>
                {key}: {value.errorMessage ?? "(no message)"}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="mt-8 flex justify-center">
        <StrictCleanupButton />
      </div>
      <div className="mt-8 overflow-x-auto">
        <p className="mb-2 font-serif text-xs text-ink-soft">
          <strong>Raw Database Rows</strong> shows every row in the catalog table.{" "}
          <strong>Strict Valid Public Packages</strong> shows only rows that passed their package
          contract and are eligible for public display. Mismatched counts mean some rows are
          awaiting cleanup.
        </p>
        <table className="vf-table w-full text-left font-serif text-sm">
          <thead className="text-xs uppercase tracking-wider text-ink-soft">
            <tr>
              <th className="px-3 py-2">Content type</th>
              <th className="px-3 py-2">Raw Database Rows</th>
              <th className="px-3 py-2">Strict Valid Public Packages</th>
              <th className="px-3 py-2">Threshold-eligible</th>
              <th className="px-3 py-2">Review</th>
              <th className="px-3 py-2">Rejected</th>
              <th className="px-3 py-2">Deleted invalid</th>
              <th className="px-3 py-2">Hidden from public</th>
              <th className="px-3 py-2">Failing source</th>
              <th className="px-3 py-2">Failing render</th>
              <th className="px-3 py-2">Failing wrong-content</th>
              <th className="px-3 py-2">Failing completeness</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const mismatched = row.rawRows > row.validPackages;
              return (
                <tr
                  key={row.contentType}
                  className={"border-t border-ink-faint/40 " + (mismatched ? "bg-amber-50" : "")}
                >
                  <td className="px-3 py-2 font-medium text-ink">{row.contentType}</td>
                  <td className="px-3 py-2">{row.rawRows.toLocaleString()}</td>
                  <td className="px-3 py-2">{row.validPackages.toLocaleString()}</td>
                  <td className="px-3 py-2">{row.thresholdEligible.toLocaleString()}</td>
                  <td className="px-3 py-2">{row.reviewRows.toLocaleString()}</td>
                  <td className="px-3 py-2">{row.rejectedPackages.toLocaleString()}</td>
                  <td className="px-3 py-2">{row.deletedInvalidRows.toLocaleString()}</td>
                  <td className="px-3 py-2">{row.removedFromPublicView.toLocaleString()}</td>
                  <td className="px-3 py-2">{row.failingSourcePurpose.toLocaleString()}</td>
                  <td className="px-3 py-2">{row.failingRenderReadiness.toLocaleString()}</td>
                  <td className="px-3 py-2">{row.failingWrongContent.toLocaleString()}</td>
                  <td className="px-3 py-2">{row.failingPackageCompleteness.toLocaleString()}</td>
                </tr>
              );
            })}
            {rows.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-center text-ink-soft" colSpan={12}>
                  No content QA data yet — run the strict cleanup job to populate.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <div className="mt-6 font-serif text-xs text-ink-faint">
        Last updated {lastUpdated.slice(0, 16)} ·{" "}
        <Link href="/admin/content-qa/deleted-log" className="ml-2 vf-nav-link">
          View deleted invalid content log →
        </Link>
      </div>
    </AdminSection>
  );
}
