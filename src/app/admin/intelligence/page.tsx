import Link from "next/link";
import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/auth/admin";
import { prisma } from "@/lib/db/client";
import { iqMetrics, isBrainEnabled, probeBrain } from "@/lib/admin-worker/intelligence";
import type { SelfModelResult } from "@/lib/admin-worker/intelligence/contracts";

export const dynamic = "force-dynamic";

/**
 * Live capability dashboard (spec: "Upgrade the admin intelligence dashboard
 * to show the brain's current capabilities and weaknesses"). The Python brain
 * is the unified reasoning core; this page surfaces what TypeScript has
 * persisted about it: brain status + protocol + op count, the self-model
 * snapshot (deep code awareness), a capability strengths/weaknesses map,
 * multi-layer memory + source reliability, the developer-request queue, recent
 * decisions and self-explanations, stuckness/blocker signals, and
 * communion-risk flags.
 *
 * Read-only and resilient: every query is guarded so the page renders even
 * when the brain is offline (it then shows stored audit data only).
 */

/** Shape persisted by runSelfModelPass into AdminWorkerLog.safeMetadata. */
interface SelfModelSnapshot {
  model?: SelfModelResult;
  weak_count?: number;
  untested_count?: number;
  orphan_count?: number;
  duplicate_pairs?: number;
  import_cycles?: number;
  coverage_ratio?: number;
  architecture?: string[];
  top_upgrades?: string[];
}

const EXPLANATION_OPS = [
  "explain_decision",
  "explain_own_architecture",
  "explain_rejected_alternatives",
  "explain_safety_gate",
  "explain_confidence",
  "explain_what_would_change_my_mind",
  "explain_authority_decision",
  "explain_retrieval_result",
  "explain_upgrade_request",
  "explain_decision_change",
];

const STUCKNESS_OPS = [
  "detect_stuckness",
  "detect_action_loop",
  "detect_source_loop",
  "detect_repair_loop",
  "detect_no_growth",
  "recommend_unblock_strategy",
];

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

  // Unified-brain data: self-model snapshot, multi-layer memory, source
  // reliability, recent self-explanations, and stuckness/blocker signals.
  const [selfModelLog, memoryByType, repTiers, repAgg, recentExplanations, stucknessCalls] =
    await Promise.all([
      prisma.adminWorkerLog
        .findFirst({
          where: { eventName: "self_model_built" },
          orderBy: { createdAt: "desc" },
          select: { message: true, safeMetadata: true, severity: true, createdAt: true },
        })
        .catch(() => null),
      prisma.adminWorkerMemory
        .groupBy({ by: ["memoryType"], _count: { _all: true }, _avg: { confidence: true } })
        .catch(
          () =>
            [] as Array<{
              memoryType: string;
              _count: { _all: number };
              _avg: { confidence: number | null };
            }>,
        ),
      prisma.adminWorkerSourceReputation
        .groupBy({ by: ["reputationTier"], _count: { _all: true } })
        .catch(() => [] as Array<{ reputationTier: string; _count: { _all: number } }>),
      prisma.adminWorkerSourceReputation
        .aggregate({
          _avg: { contentBuildSuccessRate: true, qaPassRate: true, duplicateRate: true },
        })
        .catch(() => ({
          _avg: { contentBuildSuccessRate: null, qaPassRate: null, duplicateRate: null },
        })),
      prisma.adminWorkerBrainCall
        .findMany({
          where: { op: { in: EXPLANATION_OPS } },
          orderBy: { createdAt: "desc" },
          take: 8,
          select: { op: true, reasoning: true, confidence: true, createdAt: true },
        })
        .catch(() => []),
      prisma.adminWorkerBrainCall
        .findMany({
          where: { op: { in: STUCKNESS_OPS } },
          orderBy: { createdAt: "desc" },
          take: 6,
          select: {
            op: true,
            reasoning: true,
            riskLevel: true,
            recommendedNextAction: true,
            createdAt: true,
          },
        })
        .catch(() => []),
    ]);

  const snap = (selfModelLog?.safeMetadata ?? null) as SelfModelSnapshot | null;
  const model = snap?.model ?? null;

  const brainAvgLatencyMs = brainLatencyAgg._avg.elapsedMs ?? 0;
  const brainAvgConfidence = brainLatencyAgg._avg.confidence ?? 0;
  const brainFailedCount = Math.max(0, brainCallTotal - brainOkCount);
  const brainSafeRate = brainCallTotal > 0 ? brainSafeCount / brainCallTotal : 0;
  const brainOkRate = brainCallTotal > 0 ? brainOkCount / brainCallTotal : 0;

  // Average brain risk across the risk ladder (none..critical → 0..1).
  const brainRiskRows = (await prisma.adminWorkerBrainCall
    .groupBy({ by: ["riskLevel"], _count: { _all: true } })
    .catch(() => [])) as Array<{ riskLevel: string; _count: { _all: number } }>;
  const riskWeight: Record<string, number> = {
    none: 0,
    low: 0.25,
    medium: 0.5,
    high: 0.75,
    critical: 1,
  };
  const riskTotal = brainRiskRows.reduce((s, r) => s + r._count._all, 0);
  const brainAvgRisk =
    riskTotal > 0
      ? brainRiskRows.reduce((s, r) => s + (riskWeight[r.riskLevel] ?? 0.5) * r._count._all, 0) /
        riskTotal
      : 0;

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

  // Capability map: deterministic strengths/weaknesses derived from the
  // self-model snapshot + the brain-call audit (no fabrication — every line
  // cites a stored count). This is the "what is the brain good/bad at?" view.
  const coverage = snap?.coverage_ratio ?? model?.test_coverage_ratio ?? null;
  const strengths: Array<{ label: string; detail: string }> = [];
  const weaknesses: Array<{ label: string; detail: string }> = [];

  if (probe)
    strengths.push({
      label: "Unified reasoning core",
      detail: `${probe.ops.length} brain operations online (protocol v${probe.protocolVersion})`,
    });
  if (coverage != null) {
    if (coverage >= 0.7)
      strengths.push({
        label: "Test coverage",
        detail: `${fmtPct(coverage)} of source modules are referenced by tests`,
      });
    else
      weaknesses.push({
        label: "Test coverage gap",
        detail: `only ${fmtPct(coverage)} of source modules are referenced by tests`,
      });
  }
  if (nodeCount > 0)
    strengths.push({ label: "Knowledge graph", detail: `${nodeCount} nodes / ${edgeCount} edges` });
  else weaknesses.push({ label: "Sparse knowledge graph", detail: "no graph nodes recorded yet" });
  if (embeddingCount > 0)
    strengths.push({ label: "Semantic memory", detail: `${embeddingCount} embeddings indexed` });
  if (brainCallTotal > 0) {
    if (brainOkRate >= 0.95)
      strengths.push({
        label: "Brain reliability",
        detail: `${fmtPct(brainOkRate)} of ${brainCallTotal.toLocaleString()} calls succeeded`,
      });
    else
      weaknesses.push({
        label: "Brain errors",
        detail: `${brainFailedCount} of ${brainCallTotal.toLocaleString()} brain calls failed`,
      });
  }
  if (brainCallTotal > 5) {
    const calGap = Math.abs(brainAvgConfidence - brainOkRate);
    if (calGap <= 0.1)
      strengths.push({
        label: "Confidence calibration",
        detail: `avg confidence ${fmtPct(brainAvgConfidence)} ≈ success ${fmtPct(brainOkRate)}`,
      });
    else
      weaknesses.push({
        label: "Confidence miscalibration",
        detail: `avg confidence ${fmtPct(brainAvgConfidence)} vs success ${fmtPct(brainOkRate)} (gap ${fmtPct(calGap)})`,
      });
  }
  if (snap?.weak_count)
    weaknesses.push({
      label: "Over-coupled modules",
      detail: `${snap.weak_count} large / over-imported modules flagged for refactor`,
    });
  if (snap?.untested_count)
    weaknesses.push({
      label: "Untested modules",
      detail: `${snap.untested_count} source modules lack a direct test`,
    });
  if (snap?.orphan_count)
    weaknesses.push({
      label: "Possible orphans",
      detail: `${snap.orphan_count} modules look unreferenced`,
    });
  if (snap?.duplicate_pairs)
    weaknesses.push({
      label: "Duplicate logic",
      detail: `${snap.duplicate_pairs} near-duplicate module pairs`,
    });
  if (snap?.import_cycles)
    weaknesses.push({
      label: "Import cycles",
      detail: `${snap.import_cycles} module import cycle(s) — fragile, hard-to-test coupling`,
    });
  if (openRequests > 0)
    weaknesses.push({
      label: "Open upgrade requests",
      detail: `${openRequests} self-identified improvements pending review`,
    });

  const repAvgBuild = repAgg._avg.contentBuildSuccessRate ?? null;
  const repAvgQa = repAgg._avg.qaPassRate ?? null;
  const repAvgDup = repAgg._avg.duplicateRate ?? null;

  return (
    <div className="space-y-6">
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="font-display text-3xl text-ink">Worker Intelligence</h1>
          <p className="mt-1 font-serif text-ink-soft">
            The unified Python brain reasons; TypeScript executes safely; Postgres remembers. This
            dashboard shows the brain&rsquo;s live capabilities and weaknesses — self-model, memory,
            source intelligence, calibration, and the upgrades it is asking for.
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
          <span className="text-ink-soft">
            self-model:{" "}
            {selfModelLog ? (
              <strong className="text-ink">{fmtAgo(selfModelLog.createdAt)}</strong>
            ) : (
              <span className="text-amber-700">not built yet</span>
            )}
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
        <StatCard
          label="Avg brain risk"
          value={fmtPct(brainAvgRisk)}
          tone={brainAvgRisk > 0.5 ? "rose" : "slate"}
        />
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
      </section>

      {/* Self-model & deep code awareness */}
      <section className="rounded border bg-white p-4 shadow-sm">
        <h2 className="font-display text-xl text-ink">Self-model &amp; deep code awareness</h2>
        <p className="mb-3 font-serif text-sm text-ink-soft">
          What the brain knows about its own codebase — ingested by TypeScript, reasoned over by
          Python, persisted to Postgres.{" "}
          {selfModelLog
            ? `Last built ${fmtAgo(selfModelLog.createdAt)}.`
            : "Run a worker pass to build it."}
        </p>
        {model ? (
          <>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <StatCard label="Files" value={model.file_count.toLocaleString()} tone="slate" />
              <StatCard
                label="Lines of code"
                value={model.total_lines.toLocaleString()}
                tone="slate"
              />
              <StatCard label="Routes" value={model.route_count.toLocaleString()} tone="slate" />
              <StatCard
                label="Prisma models"
                value={model.prisma_model_count.toLocaleString()}
                tone="slate"
              />
              <StatCard
                label="Brain ops"
                value={model.brain_op_count.toLocaleString()}
                tone="indigo"
              />
              <StatCard
                label="Worker stages"
                value={model.worker_stage_count.toLocaleString()}
                tone="slate"
              />
              <StatCard
                label="Test coverage"
                value={coverage != null ? fmtPct(coverage) : "n/a"}
                tone={coverage != null && coverage >= 0.7 ? "emerald" : "amber"}
              />
              <StatCard label="Scripts" value={model.script_count.toLocaleString()} tone="slate" />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-5">
              <CodeHealth label="Weak modules" value={snap?.weak_count ?? 0} />
              <CodeHealth label="Untested modules" value={snap?.untested_count ?? 0} />
              <CodeHealth label="Possible orphans" value={snap?.orphan_count ?? 0} />
              <CodeHealth label="Duplicate pairs" value={snap?.duplicate_pairs ?? 0} />
              <CodeHealth label="Import cycles" value={snap?.import_cycles ?? 0} />
            </div>

            {snap?.architecture && snap.architecture.length > 0 && (
              <div className="mt-4">
                <h3 className="text-xs uppercase tracking-wide text-ink-soft">
                  Architecture layers
                </h3>
                <div className="mt-1 flex flex-wrap gap-2">
                  {snap.architecture.map((layer, i) => (
                    <span
                      key={i}
                      className="rounded border border-stone-200 bg-stone-50 px-2 py-1 font-mono text-xs text-ink-soft"
                    >
                      {layer}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {model.largest_modules && model.largest_modules.length > 0 && (
              <div className="mt-4">
                <h3 className="text-xs uppercase tracking-wide text-ink-soft">Largest modules</h3>
                <ul className="mt-1 space-y-1 text-sm">
                  {model.largest_modules.slice(0, 6).map((m, i) => (
                    <li key={i} className="flex justify-between gap-3">
                      <span className="truncate font-mono text-xs text-ink-soft">{m.path}</span>
                      <span className="shrink-0 text-ink-soft">{m.lines.toLocaleString()} ln</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : (
          <Empty>
            No self-model snapshot recorded yet. The worker builds one on its maintenance pass.
          </Empty>
        )}
      </section>

      {/* Capability map */}
      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded border bg-white p-4 shadow-sm">
          <h2 className="font-display text-xl text-emerald-800">Capability strengths</h2>
          {strengths.length === 0 ? (
            <Empty>No strengths recorded yet — run a worker pass.</Empty>
          ) : (
            <ul className="mt-2 space-y-2">
              {strengths.map((s, i) => (
                <li key={i} className="rounded border border-emerald-200 bg-emerald-50 p-2 text-sm">
                  <strong className="text-emerald-900">{s.label}</strong>
                  <p className="font-serif text-emerald-800">{s.detail}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded border bg-white p-4 shadow-sm">
          <h2 className="font-display text-xl text-rose-800">Capability weaknesses</h2>
          {weaknesses.length === 0 ? (
            <Empty>No weaknesses flagged. (Or no self-model snapshot yet.)</Empty>
          ) : (
            <ul className="mt-2 space-y-2">
              {weaknesses.map((w, i) => (
                <li key={i} className="rounded border border-rose-200 bg-rose-50 p-2 text-sm">
                  <strong className="text-rose-900">{w.label}</strong>
                  <p className="font-serif text-rose-800">{w.detail}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Top requested upgrades (from the self-model) */}
      {snap?.top_upgrades && snap.top_upgrades.length > 0 && (
        <section className="rounded border bg-white p-4 shadow-sm">
          <h2 className="font-display text-xl text-ink">Top self-requested upgrades</h2>
          <p className="mb-3 font-serif text-sm text-ink-soft">
            Ranked by the brain from its own self-model. Code changes stay human-reviewed.
          </p>
          <ol className="list-inside list-decimal space-y-1 text-sm text-ink">
            {snap.top_upgrades.map((u, i) => (
              <li key={i}>{u}</li>
            ))}
          </ol>
        </section>
      )}

      {/* Multi-layer memory + source reliability */}
      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded border bg-white p-4 shadow-sm">
          <h2 className="font-display text-xl text-ink">Multi-layer memory</h2>
          <p className="mb-3 font-serif text-sm text-ink-soft">
            Durable learning the brain consolidates and retrieves.
          </p>
          {memoryByType.length === 0 ? (
            <Empty>No memory recorded yet.</Empty>
          ) : (
            <ul className="space-y-1 text-sm">
              {memoryByType
                .slice()
                .sort((a, b) => b._count._all - a._count._all)
                .map((m) => (
                  <li
                    key={m.memoryType}
                    className="flex justify-between rounded border border-stone-200 px-3 py-1.5"
                  >
                    <span className="font-mono text-xs">{m.memoryType.toLowerCase()}</span>
                    <span className="text-ink-soft">
                      {m._count._all} · {fmtPct(m._avg.confidence ?? 0)}
                    </span>
                  </li>
                ))}
            </ul>
          )}
        </div>
        <div className="rounded border bg-white p-4 shadow-sm">
          <h2 className="font-display text-xl text-ink">Source reliability</h2>
          <p className="mb-3 font-serif text-sm text-ink-soft">
            Learned reputation that gates which sources the worker trusts.
          </p>
          <div className="grid grid-cols-3 gap-2 text-sm">
            <CodeHealth label="Avg build success" value={fmtPct(repAvgBuild ?? 0)} invert />
            <CodeHealth label="Avg QA pass" value={fmtPct(repAvgQa ?? 0)} invert />
            <CodeHealth label="Avg dup rate" value={fmtPct(repAvgDup ?? 0)} />
          </div>
          {repTiers.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {repTiers
                .slice()
                .sort((a, b) => b._count._all - a._count._all)
                .map((t) => (
                  <span
                    key={t.reputationTier}
                    className="rounded border border-stone-200 bg-stone-50 px-2 py-1 text-xs text-ink-soft"
                  >
                    {t.reputationTier.toLowerCase()}: {t._count._all}
                  </span>
                ))}
            </div>
          )}
        </div>
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
                  {r.source && (
                    <span className="ml-auto font-mono text-xs text-ink-soft">{r.source}</span>
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

      {/* Recent self-explanations */}
      <section className="rounded border bg-white p-4 shadow-sm">
        <h2 className="font-display text-xl text-ink">Recent self-explanations</h2>
        <p className="mb-3 font-serif text-sm text-ink-soft">
          The brain explaining its own decisions, safety gates, and what would change its mind.
        </p>
        {recentExplanations.length === 0 ? (
          <Empty>No self-explanations recorded yet.</Empty>
        ) : (
          <ul className="space-y-2">
            {recentExplanations.map((e, i) => (
              <li key={i} className="rounded border border-stone-200 p-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-indigo-700">{e.op}</span>
                  <span className="text-xs text-ink-soft">{fmtPct(e.confidence)}</span>
                  <span className="ml-auto text-xs text-ink-soft">{fmtTime(e.createdAt)}</span>
                </div>
                {e.reasoning && <p className="mt-1 font-serif text-ink-soft">{e.reasoning}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Stuckness / blockers */}
      <section className="rounded border bg-white p-4 shadow-sm">
        <h2 className="font-display text-xl text-ink">Stuckness &amp; blockers</h2>
        <p className="mb-3 font-serif text-sm text-ink-soft">
          Loop/no-growth detection and the unblock strategy the brain recommends.
        </p>
        {stucknessCalls.length === 0 ? (
          <Empty>No stuckness signals — the worker is making progress.</Empty>
        ) : (
          <ul className="space-y-2">
            {stucknessCalls.map((s, i) => (
              <li key={i} className="rounded border border-amber-200 bg-amber-50 p-3 text-sm">
                <div className="flex items-center gap-2">
                  <RiskPill risk={s.riskLevel} />
                  <span className="font-mono text-xs">{s.op}</span>
                  {s.recommendedNextAction && (
                    <span className="font-mono text-xs text-ink-soft">
                      → {s.recommendedNextAction}
                    </span>
                  )}
                  <span className="ml-auto text-xs text-ink-soft">{fmtTime(s.createdAt)}</span>
                </div>
                {s.reasoning && <p className="mt-1 font-serif text-ink-soft">{s.reasoning}</p>}
              </li>
            ))}
          </ul>
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
          <p className="mb-2 font-serif text-sm text-ink-soft">
            {byOp.length} of {probe?.ops.length ?? "?"} brain operations exercised.
          </p>
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

function fmtAgo(d: Date): string {
  const ms = Date.now() - new Date(d).getTime();
  const h = ms / 3_600_000;
  if (h < 1) return `${Math.max(1, Math.round(ms / 60_000))}m ago`;
  if (h < 24) return `${Math.round(h)}h ago`;
  return `${Math.round(h / 24)}d ago`;
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

/**
 * A small code-health counter: green at zero, amber otherwise (so "0 untested"
 * reads as good). `invert` flips it for rate metrics where higher is better.
 */
function CodeHealth({
  label,
  value,
  invert = false,
}: {
  label: string;
  value: number | string;
  invert?: boolean;
}) {
  const num = typeof value === "number" ? value : Number(String(value).replace("%", ""));
  const good = invert ? num >= 50 : num === 0;
  return (
    <div className="rounded border border-stone-200 p-3">
      <div className="text-xs uppercase tracking-wide text-ink-soft">{label}</div>
      <div className={`mt-1 font-display text-xl ${good ? "text-emerald-700" : "text-amber-700"}`}>
        {value}
      </div>
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
