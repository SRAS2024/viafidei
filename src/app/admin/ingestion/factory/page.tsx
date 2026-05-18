import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import {
  loadContentFactoryDashboard,
  type MetricValue,
} from "@/lib/data/content-factory-dashboard";
import { AdminSection } from "../../_sections/AdminSection";

export const dynamic = "force-dynamic";

function MetricCard({
  label,
  value,
  dataSource,
}: {
  label: string;
  value: MetricValue;
  /**
   * Optional data-source badge naming the DB table or service the
   * metric reads from. Per the spec: "Add a diagnostic badge to
   * each admin card showing which new system table or service
   * feeds it."
   */
  dataSource?: string;
}) {
  let body: React.ReactNode;
  if (value.kind === "value") {
    body = <p className="text-3xl font-semibold">{value.value.toLocaleString()}</p>;
  } else if (value.kind === "real_zero") {
    body = (
      <>
        <p className="text-3xl font-semibold text-stone-500">0</p>
        <p className="mt-1 text-xs italic text-stone-600">{value.label}</p>
      </>
    );
  } else {
    body = (
      <>
        <p className="text-2xl font-semibold text-red-700">⚠ error</p>
        <p className="mt-1 text-xs italic text-red-700">{value.message}</p>
      </>
    );
  }
  return (
    <div className="vf-card rounded-sm border border-stone-200 bg-white p-4">
      <p className="font-serif text-xs uppercase tracking-wide text-stone-600">{label}</p>
      <div className="mt-2">{body}</div>
      {dataSource ? (
        <p
          className="mt-2 font-mono text-[10px] text-stone-500"
          data-testid={`metric-data-source-${label.toLowerCase().replace(/\s+/g, "-")}`}
        >
          data source: {dataSource}
        </p>
      ) : null}
    </div>
  );
}

function formatDateOrDash(d: Date | null): string {
  if (!d) return "—";
  return d.toISOString().slice(0, 19).replace("T", " ");
}

function formatPct(n: number | null): string {
  if (n == null) return "—";
  return `${Math.round(n * 100)}%`;
}

export default async function FactoryDashboard() {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");
  const data = await loadContentFactoryDashboard();

  return (
    <AdminSection titleKey="admin.card.ingestion">
      <div className="mb-6">
        <h2 className="font-display text-2xl">Content Factory Dashboard</h2>
        <p className="mt-2 font-serif text-sm text-stone-700">
          Live picture of the new Planner → Queue → Worker → Builder → Strict QA → Persistence
          pipeline. Every metric reads from the durable tables: zero only ever means &ldquo;no rows
          yet&rdquo; — never &ldquo;the dashboard is disconnected&rdquo;.
        </p>
        {data.progress.stalledReason ? (
          <div className="mt-4 rounded-sm border-l-4 border-amber-500 bg-amber-50 p-3 font-serif text-sm text-amber-900">
            <strong>Stalled:</strong> {data.progress.stalledReason}
          </div>
        ) : null}
      </div>

      <h3 className="font-display text-lg">Queue</h3>
      <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MetricCard label="Pending" value={data.queue.pending} dataSource="IngestionJobQueue" />
        <MetricCard label="Running" value={data.queue.running} dataSource="IngestionJobQueue" />
        <MetricCard label="Retrying" value={data.queue.retrying} dataSource="IngestionJobQueue" />
        <MetricCard label="Failed" value={data.queue.failed} dataSource="IngestionJobQueue" />
      </div>

      <h3 className="mt-8 font-display text-lg">Workers</h3>
      <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <MetricCard label="Active" value={data.workers.active} dataSource="WorkerHeartbeat" />
        <MetricCard label="Stale" value={data.workers.stale} dataSource="WorkerHeartbeat" />
        <div className="vf-card rounded-sm border border-stone-200 bg-white p-4">
          <p className="font-serif text-xs uppercase tracking-wide text-stone-600">
            Last heartbeat
          </p>
          <p className="mt-2 font-serif text-sm">
            {formatDateOrDash(data.workers.lastHeartbeatAt)}
          </p>
          <p className="mt-2 font-mono text-[10px] text-stone-500">data source: WorkerHeartbeat</p>
        </div>
      </div>

      <h3 className="mt-8 font-display text-lg">Pipeline timestamps</h3>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 font-serif text-sm">
        <p>
          <strong>Last source fetch:</strong> {formatDateOrDash(data.timestamps.lastSourceFetch)}
        </p>
        <p>
          <strong>Last source discovery:</strong>{" "}
          {formatDateOrDash(data.timestamps.lastSourceDiscovery)}
        </p>
        <p>
          <strong>Last package build:</strong> {formatDateOrDash(data.timestamps.lastPackageBuild)}
        </p>
        <p>
          <strong>Last strict QA pass:</strong> {formatDateOrDash(data.timestamps.lastStrictQaPass)}
        </p>
        <p>
          <strong>Last content cleanup:</strong>{" "}
          {formatDateOrDash(data.timestamps.lastContentCleanup)}
        </p>
        <p>
          <strong>Last valid package created:</strong>{" "}
          {formatDateOrDash(data.timestamps.lastValidPackageCreated)}
        </p>
        <p>
          <strong>Last invalid row deleted:</strong>{" "}
          {formatDateOrDash(data.timestamps.lastInvalidRowDeleted)}
        </p>
      </div>

      <h3 className="mt-8 font-display text-lg">Content progress</h3>
      <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MetricCard label="Raw rows" value={data.progress.rawRows} dataSource="SourceDocument" />
        <MetricCard
          label="Source documents"
          value={data.progress.sourceDocuments}
          dataSource="SourceDocument"
        />
        <MetricCard
          label="Build attempts"
          value={data.progress.buildAttempts}
          dataSource="ContentPackageBuildLog"
        />
        <MetricCard
          label="Built packages"
          value={data.progress.builtPackages}
          dataSource="ContentPackageBuildLog"
        />
        <MetricCard
          label="Build failures"
          value={data.progress.buildFailures}
          dataSource="ContentPackageBuildLog"
        />
        <MetricCard
          label="QA passes"
          value={data.progress.qaPasses}
          dataSource="ContentPackageBuildLog"
        />
        <MetricCard
          label="QA failures"
          value={data.progress.qaFailures}
          dataSource="RejectedContentLog"
        />
        <MetricCard
          label="Persisted packages"
          value={data.progress.validPackages}
          dataSource="ContentPackageBuildLog"
        />
        <MetricCard
          label="Public packages"
          value={data.progress.publicPackages}
          dataSource="Catalog tables (strict gate)"
        />
        <MetricCard
          label="Deleted invalid rows"
          value={data.progress.deletedInvalidRows}
          dataSource="RejectedContentLog"
        />
        <MetricCard
          label="Threshold eligible"
          value={data.progress.thresholdEligible}
          dataSource="Catalog tables (strict gate)"
        />
        <MetricCard
          label="Growth (24h)"
          value={data.progress.growthRateLast24h}
          dataSource="Catalog (24h window)"
        />
      </div>

      <h3 className="mt-8 font-display text-lg">Source quality</h3>
      <p className="mt-2 font-serif text-xs text-stone-600">
        Top 100 source / content-type pairs ranked by lowest build success first so the worst actors
        are visible. Auto-paused sources are skipped by the planner.
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="min-w-full border-collapse font-serif text-xs">
          <thead className="bg-stone-100">
            <tr>
              <th className="border border-stone-200 px-2 py-1 text-left">Source / Type</th>
              <th className="border border-stone-200 px-2 py-1 text-right">Discovered</th>
              <th className="border border-stone-200 px-2 py-1 text-right">Fetched</th>
              <th className="border border-stone-200 px-2 py-1 text-right">Build %</th>
              <th className="border border-stone-200 px-2 py-1 text-right">QA pass %</th>
              <th className="border border-stone-200 px-2 py-1 text-right">Rejection %</th>
              <th className="border border-stone-200 px-2 py-1 text-right">Duplicate %</th>
              <th className="border border-stone-200 px-2 py-1 text-left">Last success</th>
              <th className="border border-stone-200 px-2 py-1 text-left">Last failure</th>
              <th className="border border-stone-200 px-2 py-1 text-left">Auto-paused</th>
            </tr>
          </thead>
          <tbody>
            {data.sources.length === 0 ? (
              <tr>
                <td
                  colSpan={10}
                  className="border border-stone-200 px-2 py-3 italic text-stone-600"
                >
                  No source quality data recorded yet.
                </td>
              </tr>
            ) : (
              data.sources.map((s) => (
                <tr key={`${s.sourceId}:${s.contentType}`}>
                  <td className="border border-stone-200 px-2 py-1">
                    {s.sourceId.slice(0, 8)}… / {s.contentType}
                  </td>
                  <td className="border border-stone-200 px-2 py-1 text-right">
                    {s.discoveredCount}
                  </td>
                  <td className="border border-stone-200 px-2 py-1 text-right">{s.fetchedCount}</td>
                  <td className="border border-stone-200 px-2 py-1 text-right">
                    {formatPct(s.buildSuccessRate)}
                  </td>
                  <td className="border border-stone-200 px-2 py-1 text-right">
                    {formatPct(s.qaPassRate)}
                  </td>
                  <td className="border border-stone-200 px-2 py-1 text-right">
                    {formatPct(s.rejectionRate)}
                  </td>
                  <td className="border border-stone-200 px-2 py-1 text-right">
                    {formatPct(s.duplicateRate)}
                  </td>
                  <td className="border border-stone-200 px-2 py-1">
                    {formatDateOrDash(s.lastSuccessAt)}
                  </td>
                  <td
                    className="border border-stone-200 px-2 py-1"
                    title={s.lastFailureReason ?? undefined}
                  >
                    {formatDateOrDash(s.lastFailureAt)}
                  </td>
                  <td className="border border-stone-200 px-2 py-1">
                    {s.autoPaused ? "yes" : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </AdminSection>
  );
}
