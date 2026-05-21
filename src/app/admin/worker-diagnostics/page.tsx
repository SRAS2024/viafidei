import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getWorkerHealthDiagnostics } from "@/lib/diagnostics/worker-health";
import { getPipelineStatus } from "@/lib/diagnostics/pipeline-status";
import { listQueueJobs } from "@/lib/ingestion/queue/queue";
import { getChainMetrics, type ChainMetricsReport } from "@/lib/diagnostics/chain-metrics";
import {
  getSourceReadinessSummary,
  type SourceReadinessSummary,
} from "@/lib/diagnostics/source-readiness";
import { AdminSection } from "../_sections/AdminSection";
import { WorkerOpsPanel } from "./WorkerOpsPanel";

export const dynamic = "force-dynamic";

const STUCK_THRESHOLD_MS = 5 * 60 * 1000;

function fmtAge(ms: number | null): string {
  if (ms == null) return "—";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  return `${Math.round(m / 60)}h`;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <tr className="border-b border-ink/10">
      <td className="py-1 pr-3 text-ink-soft">{label}</td>
      <td className="py-1">{value}</td>
    </tr>
  );
}

/** Visual pipeline chain row — Discovery → … → Cache. */
function ChainMetricsSection({ chain }: { chain: ChainMetricsReport | null }) {
  if (!chain) {
    return (
      <section className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4">
        <p className="font-serif text-sm text-red-800">Pipeline chain metrics unavailable.</p>
      </section>
    );
  }
  return (
    <section className="rounded-2xl border border-ink/10 bg-paper px-5 py-4">
      <h2 className="font-serif text-lg font-semibold">Pipeline chain</h2>
      {chain.blockerStage ? (
        <p className="mt-1 font-serif text-sm text-amber-800">
          Blocker stage: {chain.blockerStage}
        </p>
      ) : (
        <p className="mt-1 font-serif text-sm text-ink-soft">No chain blocker detected.</p>
      )}
      <div
        className="mt-3 flex flex-wrap items-center gap-1 font-mono text-xs"
        data-testid="pipeline-chain-row"
      >
        {chain.stages.map((s, i) => (
          <div key={s.stage} className="flex items-center gap-1">
            <div
              className={`rounded-lg border px-2 py-1.5 ${
                s.stage === chain.blockerStage
                  ? "border-red-300 bg-red-50"
                  : "border-ink/15 bg-paper"
              }`}
            >
              <div className="font-semibold">{s.label}</div>
              <div className="text-ink-soft">count: {s.count}</div>
              {s.failureEvent ? <div className="text-red-700">fail: {s.failureCount}</div> : null}
              <div className="text-ink-faint">
                {s.latestAt
                  ? s.latestAt.toISOString().slice(0, 16).replace("T", " ")
                  : s.instrumented
                    ? "—"
                    : "not tracked"}
              </div>
            </div>
            {i < chain.stages.length - 1 ? <span className="text-ink-faint">→</span> : null}
          </div>
        ))}
      </div>
    </section>
  );
}

/** Source readiness summary + per-content-type source coverage. */
function SourceReadinessSection({ readiness }: { readiness: SourceReadinessSummary | null }) {
  if (!readiness) {
    return (
      <section className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4">
        <p className="font-serif text-sm text-red-800">Source readiness summary unavailable.</p>
      </section>
    );
  }
  const counts: ReadonlyArray<[string, number]> = [
    ["Total sources", readiness.totalSources],
    ["Factory-ready sources", readiness.factoryReadySources],
    ["Sources with jobs", readiness.sourcesWithJobs],
    ["Sources with zero jobs", readiness.sourcesWithZeroJobs],
    ["Sources with discovery method", readiness.sourcesWithDiscoveryMethod],
    ["Sources without discovery method", readiness.sourcesWithoutDiscoveryMethod],
    ["Paused sources", readiness.pausedSources],
    ["Unhealthy sources", readiness.unhealthySources],
    ["Not configured sources", readiness.notConfiguredSources],
    ["Sources that produced documents", readiness.sourcesThatProducedDocuments],
  ];
  return (
    <section
      className="rounded-2xl border border-ink/10 bg-paper px-5 py-4"
      data-testid="source-readiness-summary"
    >
      <h2 className="font-serif text-lg font-semibold">Source readiness</h2>
      <table className="mt-3 w-full border-collapse font-mono text-xs">
        <tbody>
          {counts.map(([label, value]) => (
            <Row key={label} label={label} value={String(value)} />
          ))}
        </tbody>
      </table>
      {readiness.contentTypeCoverage.length > 0 ? (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full border-collapse font-mono text-xs">
            <thead>
              <tr className="border-b border-ink/20 text-left">
                {[
                  "Content type",
                  "Required",
                  "Configured",
                  "Factory-ready",
                  "Validation",
                  "Enrichment",
                  "Shortfall",
                ].map((h) => (
                  <th key={h} className="py-1 pr-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {readiness.contentTypeCoverage.map((c) => (
                <tr key={c.contentType} className="border-b border-ink/10">
                  <td className="py-1 pr-3">{c.contentType}</td>
                  <td className="py-1 pr-3">{c.required}</td>
                  <td className="py-1 pr-3">{c.configured}</td>
                  <td className="py-1 pr-3">{c.factoryReady}</td>
                  <td className="py-1 pr-3">{c.validationSources}</td>
                  <td className="py-1 pr-3">{c.enrichmentSources}</td>
                  <td className={`py-1 pr-3 ${c.shortfall > 0 ? "text-amber-700" : ""}`}>
                    {c.shortfall}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

/**
 * Worker & pipeline diagnostics page. Shows worker health, the
 * pipeline blocker, the pending job queue, and the repair / recovery
 * actions — every action button maps to a protected admin API route.
 */
export default async function WorkerDiagnosticsPage() {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");

  const [worker, pipeline, pendingJobs, chain, sourceReadiness] = await Promise.all([
    getWorkerHealthDiagnostics().catch(() => null),
    getPipelineStatus().catch(() => null),
    listQueueJobs({ status: "pending", take: 100 }).catch(() => []),
    getChainMetrics().catch(() => null),
    getSourceReadinessSummary().catch(() => null),
  ]);

  const queueStuck =
    !!worker &&
    !worker.workerAlive &&
    worker.oldestPendingAgeMs != null &&
    worker.oldestPendingAgeMs > STUCK_THRESHOLD_MS;

  return (
    <AdminSection
      titleKey="Worker & Pipeline Diagnostics"
      subtitle="Worker health, pipeline blocker, repair actions, and the pending job queue."
    >
      <div className="mx-auto max-w-6xl space-y-6">
        {queueStuck ? (
          <div
            className="rounded-2xl border border-red-300 bg-red-50 px-5 py-4"
            data-testid="queue-stuck-warning"
          >
            <p className="font-serif text-sm text-red-900">
              Queue has pending jobs older than 5 minutes and no healthy worker is processing them.
            </p>
          </div>
        ) : null}

        <section className="rounded-2xl border border-ink/10 bg-paper px-5 py-4">
          <h2 className="font-serif text-lg font-semibold">Worker health</h2>
          {worker ? (
            <>
              <p className="mt-1 font-serif text-sm">{worker.message}</p>
              <table className="mt-3 w-full border-collapse font-mono text-xs">
                <tbody>
                  <Row label="Worker alive" value={worker.workerAlive ? "yes" : "no"} />
                  <Row label="Process type" value={worker.processType ?? "—"} />
                  <Row label="Worker ID" value={worker.workerId ?? "—"} />
                  <Row label="Hostname" value={worker.hostname ?? "—"} />
                  <Row
                    label="Last heartbeat"
                    value={worker.lastHeartbeatAt ? worker.lastHeartbeatAt.toISOString() : "—"}
                  />
                  <Row label="Heartbeat age" value={fmtAge(worker.heartbeatAgeMs)} />
                  <Row label="Worker status" value={worker.workerStatus ?? "—"} />
                  <Row
                    label="Processed / failed / retry"
                    value={`${worker.processedCount ?? "—"} / ${worker.failedCount ?? "—"} / ${
                      worker.retryCount ?? "—"
                    }`}
                  />
                  <Row label="Current job ID" value={worker.currentJobId ?? "—"} />
                  <Row
                    label="Pending / running / failed jobs"
                    value={`${worker.pendingJobs} / ${worker.runningJobs} / ${worker.failedJobs}`}
                  />
                  <Row label="Oldest pending job age" value={fmtAge(worker.oldestPendingAgeMs)} />
                </tbody>
              </table>
              {worker.likelyCauses.length > 0 ? (
                <div className="mt-2 font-mono text-xs" data-testid="worker-likely-causes">
                  <span className="text-ink-soft">Likely causes:</span>
                  <ul className="ml-4 list-disc">
                    {worker.likelyCauses.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {worker.topFailureReasons.length > 0 ? (
                <div className="mt-2 font-mono text-xs">
                  <span className="text-ink-soft">Top failure reasons:</span>
                  <ul className="ml-4 list-disc">
                    {worker.topFailureReasons.map((f) => (
                      <li key={f.reason}>
                        {f.reason} ({f.count})
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          ) : (
            <p className="mt-1 font-serif text-sm text-red-700">
              Worker health query failed — check the server logs.
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-ink/10 bg-paper px-5 py-4">
          <h2 className="font-serif text-lg font-semibold">Pipeline status</h2>
          {pipeline ? (
            <table className="mt-3 w-full border-collapse font-mono text-xs">
              <tbody>
                <Row label="Queue pending" value={String(pipeline.queuePending)} />
                <Row
                  label="Worker heartbeat"
                  value={pipeline.workerHealthy ? "healthy" : "missing"}
                />
                <Row label="Source documents" value={String(pipeline.sourceDocuments)} />
                <Row label="Build logs" value={String(pipeline.buildLogs)} />
                <Row label="QA passes" value={String(pipeline.qaPasses)} />
                <Row label="Persisted packages" value={String(pipeline.persistedPackages)} />
                <Row label="Strict public rows" value={String(pipeline.strictPublicRows)} />
                <Row label="Current blocker" value={pipeline.blocker ?? "none"} />
              </tbody>
            </table>
          ) : (
            <p className="mt-1 font-serif text-sm text-red-700">Pipeline status query failed.</p>
          )}
        </section>

        <ChainMetricsSection chain={chain} />

        <SourceReadinessSection readiness={sourceReadiness} />

        <section>
          <h2 className="mb-3 font-serif text-lg font-semibold">Repair &amp; diagnostic actions</h2>
          <WorkerOpsPanel />
        </section>

        <section className="rounded-2xl border border-ink/10 bg-paper px-5 py-4">
          <h2 className="font-serif text-lg font-semibold">Pending jobs ({pendingJobs.length})</h2>
          {pendingJobs.length === 0 ? (
            <p className="mt-1 font-serif text-sm text-ink-soft">No pending jobs in the queue.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table
                className="w-full border-collapse font-mono text-xs"
                data-testid="pending-jobs-table"
              >
                <thead>
                  <tr className="border-b border-ink/20 text-left">
                    {[
                      "Job ID",
                      "Kind",
                      "Name",
                      "Source",
                      "Content type",
                      "Priority",
                      "Run at",
                      "Status",
                      "Attempts",
                      "Last error",
                      "Created",
                      "Updated",
                    ].map((h) => (
                      <th key={h} className="py-1 pr-3">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pendingJobs.map((j) => (
                    <tr key={j.id} className="border-b border-ink/10">
                      <td className="py-1 pr-3">{j.id}</td>
                      <td className="py-1 pr-3">{j.jobKind}</td>
                      <td className="py-1 pr-3">{j.jobName}</td>
                      <td className="py-1 pr-3">{j.sourceId ?? "—"}</td>
                      <td className="py-1 pr-3">{j.contentType ?? "—"}</td>
                      <td className="py-1 pr-3">{j.priority}</td>
                      <td className="py-1 pr-3">{j.runAt.toISOString()}</td>
                      <td className="py-1 pr-3">{j.status}</td>
                      <td className="py-1 pr-3">{j.attempts}</td>
                      <td className="py-1 pr-3">{j.lastError ?? "—"}</td>
                      <td className="py-1 pr-3">{j.createdAt.toISOString()}</td>
                      <td className="py-1 pr-3">{j.updatedAt.toISOString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </AdminSection>
  );
}
