import Link from "next/link";
import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/auth/admin";
import { prisma } from "@/lib/db/client";
import { iqMetrics, isBrainEnabled, probeBrain } from "@/lib/admin-worker/intelligence";

export const dynamic = "force-dynamic";

/**
 * Intelligence Dashboard (spec: "Add an intelligence dashboard in the
 * admin area"). Surfaces the Python brain's activity that TypeScript has
 * persisted: brain online status, worker-IQ metrics, recent decisions
 * with confidence + risk, the developer-request queue, communion-risk
 * flags, and semantic-memory / knowledge-graph counts.
 *
 * Read-only and resilient: every query is guarded so the page renders even
 * when the brain is offline (it then shows stored audit data only).
 */
export default async function AdminIntelligencePage() {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");

  // Probe the brain (best-effort — null when python3 isn't available here).
  const probe = await probeBrain().catch(() => null);

  const [
    brainCallTotal,
    embeddingCount,
    nodeCount,
    edgeCount,
    openRequests,
    recentCalls,
    byOp,
    developerRequests,
    communionFlags,
    brainOkCount,
    brainSafeCount,
    brainLatencyAgg,
    learningEventCount,
    strategyMemoryCount,
  ] = await Promise.all([
    prisma.adminWorkerBrainCall.count().catch(() => 0),
    prisma.adminWorkerEmbedding.count().catch(() => 0),
    prisma.adminWorkerGraphNode.count().catch(() => 0),
    prisma.adminWorkerGraphEdge.count().catch(() => 0),
    prisma.adminWorkerDeveloperRequest.count({ where: { status: "OPEN" } }).catch(() => 0),
    prisma.adminWorkerBrainCall
      .findMany({
        orderBy: { createdAt: "desc" },
        take: 15,
        select: {
          op: true,
          ok: true,
          confidence: true,
          riskLevel: true,
          recommendedNextAction: true,
          reasoning: true,
          createdAt: true,
        },
      })
      .catch(() => []),
    prisma.adminWorkerBrainCall
      .groupBy({ by: ["op"], _count: { _all: true }, _avg: { confidence: true } })
      .catch(
        () =>
          [] as Array<{
            op: string;
            _count: { _all: number };
            _avg: { confidence: number | null };
          }>,
      ),
    prisma.adminWorkerDeveloperRequest
      .findMany({
        where: { status: "OPEN" },
        orderBy: [{ severity: "desc" }, { occurrences: "desc" }, { updatedAt: "desc" }],
        take: 12,
        select: {
          kind: true,
          title: true,
          detail: true,
          severity: true,
          occurrences: true,
          source: true,
          updatedAt: true,
        },
      })
      .catch(() => []),
    prisma.adminWorkerBrainCall
      .findMany({
        where: { op: "detect_communion_risk", riskLevel: { in: ["high", "critical"] } },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: { reasoning: true, riskLevel: true, recommendedNextAction: true, createdAt: true },
      })
      .catch(() => []),
    // Brain IQ diagnostics: success rate, latency, safe-to-auto-execute
    // rate, learning events, and strategy-memory size.
    prisma.adminWorkerBrainCall.count({ where: { ok: true } }).catch(() => 0),
    prisma.adminWorkerBrainCall.count({ where: { safeToAutoExecute: true } }).catch(() => 0),
    prisma.adminWorkerBrainCall
      .aggregate({ _avg: { elapsedMs: true, confidence: true } })
      .catch(() => ({ _avg: { elapsedMs: null, confidence: null } })),
    prisma.adminWorkerBrainCall.count({ where: { op: "learn_from_outcome" } }).catch(() => 0),
    prisma.adminWorkerMemory.count().catch(() => 0),
  ]);

  const brainAvgLatencyMs = brainLatencyAgg._avg.elapsedMs ?? 0;
  const brainAvgConfidence = brainLatencyAgg._avg.confidence ?? 0;
  const brainFailedCount = Math.max(0, brainCallTotal - brainOkCount);
  const brainSafeRate = brainCallTotal > 0 ? brainSafeCount / brainCallTotal : 0;

  // Live worker-IQ for display only — uses the read-only wrapper (no audit
  // row written on a page view). Falls back to "n/a" when the brain is off.
  let dupCandidates = 0;
  let dupPrevented = 0;
  let preventedBadPublishes = 0;
  let learningRecords = 0;
  try {
    [dupCandidates, dupPrevented, preventedBadPublishes, learningRecords] = await Promise.all([
      prisma.adminWorkerBrainCall.count({ where: { op: "detect_duplicates" } }),
      prisma.adminWorkerBrainCall.count({
        where: { op: "detect_duplicates", recommendedNextAction: "block-as-duplicate" },
      }),
      prisma.adminWorkerBrainCall.count({
        where: {
          op: { in: ["score_quality", "detect_communion_risk", "assess_source"] },
          riskLevel: { in: ["high", "critical"] },
        },
      }),
      prisma.adminWorkerMemory.count().catch(() => 0),
    ]);
  } catch {
    /* leave zeros */
  }
  const iq = await iqMetrics({
    duplicateCandidates: dupCandidates,
    duplicatesPrevented: dupPrevented,
    preventedBadPublishes,
    learningRecords,
  }).catch(() => null);
  const metrics = iq?.ok ? (iq.result?.metrics ?? null) : null;

  return (
    <div className="space-y-6">
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="font-display text-3xl text-ink">Worker Intelligence</h1>
          <p className="mt-1 font-serif text-ink-soft">
            The Python intelligence brain that advises the Admin Worker — memory, source
            intelligence, duplicate detection, quality, repair, and self-inspection.
          </p>
        </div>
        <Link className="text-indigo-600 underline" href="/admin">
          ← dashboard
        </Link>
      </header>

      {/* Brain status */}
      <section className="rounded border bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <StatusDot online={!!probe} />
          <span>
            Brain:{" "}
            <strong className={probe ? "text-emerald-700" : "text-rose-700"}>
              {probe ? "online" : "offline"}
            </strong>
          </span>
          {probe && <span className="text-ink-soft">protocol v{probe.protocolVersion}</span>}
          {probe && <span className="text-ink-soft">{probe.ops.length} operations</span>}
          <span className="text-ink-soft">
            feature flag:{" "}
            <code className="rounded bg-stone-100 px-1">
              {isBrainEnabled() ? "enabled" : "disabled"}
            </code>
          </span>
        </div>
      </section>

      {/* Worker IQ + counters */}
      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          label="Worker IQ index"
          value={metrics ? `${metrics.iq_index}` : "n/a"}
          tone="indigo"
        />
        <StatCard label="Brain decisions" value={brainCallTotal.toLocaleString()} tone="slate" />
        <StatCard
          label="Dup. prevention"
          value={metrics ? fmtPct(metrics.duplicate_prevention_rate) : "n/a"}
          tone="emerald"
        />
        <StatCard
          label="Prevented bad publishes"
          value={preventedBadPublishes.toLocaleString()}
          tone="amber"
        />
        <StatCard label="Semantic memory" value={embeddingCount.toLocaleString()} tone="slate" />
        <StatCard label="Graph nodes" value={nodeCount.toLocaleString()} tone="slate" />
        <StatCard label="Graph edges" value={edgeCount.toLocaleString()} tone="slate" />
        <StatCard label="Open dev requests" value={openRequests.toLocaleString()} tone="rose" />
      </section>

      {/* Brain IQ diagnostics — availability/latency/safety/learning */}
      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          label="Brain calls ok / failed"
          value={`${brainOkCount.toLocaleString()} / ${brainFailedCount.toLocaleString()}`}
          tone={brainFailedCount === 0 ? "emerald" : "amber"}
        />
        <StatCard
          label="Avg brain latency"
          value={`${Math.round(brainAvgLatencyMs)} ms`}
          tone="slate"
        />
        <StatCard label="Avg brain confidence" value={fmtPct(brainAvgConfidence)} tone="indigo" />
        <StatCard label="Safe-to-auto-execute" value={fmtPct(brainSafeRate)} tone="emerald" />
        <StatCard
          label="Learning events"
          value={learningEventCount.toLocaleString()}
          tone="slate"
        />
        <StatCard
          label="Strategy memory rows"
          value={strategyMemoryCount.toLocaleString()}
          tone="slate"
        />
        <StatCard label="Protocol" value={`v${probe?.protocolVersion ?? "?"}`} tone="slate" />
        <StatCard
          label="Brain"
          value={probe ? "online" : "fallback"}
          tone={probe ? "emerald" : "amber"}
        />
      </section>

      {/* Developer requests */}
      <section className="rounded border bg-white p-4 shadow-sm">
        <h2 className="font-display text-xl text-ink">Developer requests</h2>
        <p className="mb-3 font-serif text-sm text-ink-soft">
          What the worker believes it needs to do its job better.
        </p>
        {developerRequests.length === 0 ? (
          <Empty>No open developer requests.</Empty>
        ) : (
          <ul className="space-y-2">
            {developerRequests.map((r, i) => (
              <li key={i} className="rounded border border-stone-200 p-3">
                <div className="flex items-center gap-2 text-sm">
                  <SeverityPill severity={r.severity} />
                  <span className="rounded bg-stone-100 px-1.5 py-0.5 text-xs uppercase text-ink-soft">
                    {r.kind}
                  </span>
                  <strong className="text-ink">{r.title}</strong>
                  {r.occurrences > 1 && (
                    <span className="text-xs text-ink-soft">×{r.occurrences}</span>
                  )}
                </div>
                <p className="mt-1 font-serif text-sm text-ink-soft">{r.detail}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Recent decisions */}
      <section className="rounded border bg-white p-4 shadow-sm">
        <h2 className="font-display text-xl text-ink">Recent brain decisions</h2>
        {recentCalls.length === 0 ? (
          <Empty>No brain activity recorded yet. Run a worker pass to populate this.</Empty>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b text-left text-ink-soft">
                  <th className="py-2 pr-3">Operation</th>
                  <th className="py-2 pr-3">Confidence</th>
                  <th className="py-2 pr-3">Risk</th>
                  <th className="py-2 pr-3">Recommendation</th>
                  <th className="py-2 pr-3">When</th>
                </tr>
              </thead>
              <tbody>
                {recentCalls.map((c, i) => (
                  <tr key={i} className="border-b border-stone-100 align-top">
                    <td className="py-2 pr-3 font-mono text-xs">{c.op}</td>
                    <td className="py-2 pr-3">{(c.confidence * 100).toFixed(0)}%</td>
                    <td className="py-2 pr-3">
                      <RiskPill risk={c.riskLevel} />
                    </td>
                    <td className="py-2 pr-3 font-mono text-xs">
                      {c.recommendedNextAction ?? "—"}
                    </td>
                    <td className="py-2 pr-3 text-xs text-ink-soft">{fmtTime(c.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Communion-risk flags */}
      <section className="rounded border bg-white p-4 shadow-sm">
        <h2 className="font-display text-xl text-ink">Catholic communion-risk flags</h2>
        <p className="mb-3 font-serif text-sm text-ink-soft">
          Verification flags (not canonical rulings) where a source/content may not be in full
          communion with Rome. These prevent auto-publishing until a human verifies.
        </p>
        {communionFlags.length === 0 ? (
          <Empty>No communion-risk flags.</Empty>
        ) : (
          <ul className="space-y-2">
            {communionFlags.map((f, i) => (
              <li key={i} className="rounded border border-rose-200 bg-rose-50 p-3 text-sm">
                <div className="flex items-center gap-2">
                  <RiskPill risk={f.riskLevel} />
                  <span className="font-mono text-xs">{f.recommendedNextAction ?? ""}</span>
                  <span className="text-xs text-ink-soft">{fmtTime(f.createdAt)}</span>
                </div>
                <p className="mt-1 font-serif text-ink-soft">{f.reasoning}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Operation mix */}
      {byOp.length > 0 && (
        <section className="rounded border bg-white p-4 shadow-sm">
          <h2 className="font-display text-xl text-ink">Operation mix</h2>
          <div className="mt-2 grid grid-cols-2 gap-2 text-sm md:grid-cols-3">
            {byOp
              .slice()
              .sort((a, b) => b._count._all - a._count._all)
              .map((o) => (
                <div
                  key={o.op}
                  className="flex justify-between rounded border border-stone-200 px-3 py-2"
                >
                  <span className="font-mono text-xs">{o.op}</span>
                  <span className="text-ink-soft">
                    {o._count._all} · {((o._avg.confidence ?? 0) * 100).toFixed(0)}%
                  </span>
                </div>
              ))}
          </div>
        </section>
      )}
    </div>
  );
}

function fmtPct(n: number): string {
  return `${(n * 100).toFixed(0)}%`;
}

function fmtTime(d: Date): string {
  return new Date(d).toISOString().slice(0, 16).replace("T", " ");
}

function StatusDot({ online }: { online: boolean }) {
  return (
    <span
      className={`inline-block h-2.5 w-2.5 rounded-full ${online ? "bg-emerald-500" : "bg-rose-500"}`}
      aria-hidden
    />
  );
}

const TONES: Record<string, string> = {
  indigo: "text-indigo-700",
  emerald: "text-emerald-700",
  amber: "text-amber-700",
  rose: "text-rose-700",
  slate: "text-slate-700",
};

function StatCard({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded border bg-white p-4 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-ink-soft">{label}</div>
      <div className={`mt-1 font-display text-2xl ${TONES[tone] ?? "text-ink"}`}>{value}</div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="font-serif text-sm text-ink-soft">{children}</p>;
}

function RiskPill({ risk }: { risk: string }) {
  const map: Record<string, string> = {
    none: "bg-stone-100 text-stone-600",
    low: "bg-emerald-100 text-emerald-700",
    medium: "bg-amber-100 text-amber-800",
    high: "bg-orange-100 text-orange-800",
    critical: "bg-rose-100 text-rose-800",
  };
  return (
    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${map[risk] ?? map.low}`}>
      {risk}
    </span>
  );
}

function SeverityPill({ severity }: { severity: string }) {
  const map: Record<string, string> = {
    low: "bg-stone-100 text-stone-600",
    medium: "bg-amber-100 text-amber-800",
    high: "bg-rose-100 text-rose-800",
  };
  return (
    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${map[severity] ?? map.medium}`}>
      {severity}
    </span>
  );
}
