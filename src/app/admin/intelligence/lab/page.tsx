import Link from "next/link";
import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/auth/admin";
import { prisma } from "@/lib/db/client";
import { collectIntelligenceLabData } from "@/lib/admin-worker/intelligence-lab-store";

export const dynamic = "force-dynamic";

/**
 * Intelligence Laboratory dashboard (spec: "Add Intelligence Laboratory
 * dashboard pages"). Read-only surfaces for the lab's durable Postgres store:
 * causal/root-cause, hypotheses, experiments, counterfactuals, proof packets +
 * failed proofs, logic-rule health, claim epistemic statuses, strategy
 * tournaments, benchmark scores + brain versions, digital-twin runs, capability
 * proposals, curriculum progress, adversarial weaknesses, architecture
 * integrity, and the highest-leverage next change. Every panel is guarded so
 * the page renders even when the lab store is empty.
 */

function Panel({
  title,
  empty,
  children,
}: {
  title: string;
  empty?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="vf-card rounded-sm p-5">
      <h2 className="font-display text-lg text-ink">{title}</h2>
      <div className="mt-3 space-y-1.5 text-sm">
        {empty ? <p className="text-ink-faint">No records yet.</p> : children}
      </div>
    </section>
  );
}

function Row({ left, right }: { left: string; right?: string }) {
  return (
    <div className="flex justify-between gap-3 rounded border border-stone-200 px-3 py-1.5">
      <span className="text-ink">{left}</span>
      {right ? <span className="font-mono text-xs text-ink-soft">{right}</span> : null}
    </div>
  );
}

export default async function IntelligenceLabPage() {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");

  const lab = await collectIntelligenceLabData(prisma, { limit: 10 });

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
      <div className="flex items-baseline justify-between">
        <div>
          <p className="vf-eyebrow text-ink-faint">Admin Worker</p>
          <h1 className="mt-1 font-display text-3xl text-ink">Intelligence Laboratory</h1>
        </div>
        <Link href="/admin/intelligence" className="vf-nav-link text-sm">
          ← Intelligence
        </Link>
      </div>
      <p className="mt-2 font-serif text-sm text-ink-soft">
        Causal reasoning, formal proof, safe experiments, benchmarked self-evaluation, strategy
        comparison, adversarial self-testing, capability invention, and architecture governance —
        all advisory and review-gated. The lab recommends; humans approve code, schema, and
        deployment.
      </p>

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <Panel title="Highest-leverage next change">
          {lab.highestLeverage ? (
            <p className="font-serif text-ink">{lab.highestLeverage}</p>
          ) : (
            <p className="text-ink-faint">Awaiting the next lab pass.</p>
          )}
        </Panel>

        <Panel title="Architecture integrity">
          <Row
            left={
              lab.latestArchitectureIntegrity == null
                ? "Not yet evaluated"
                : `Integrity ${(lab.latestArchitectureIntegrity * 100).toFixed(0)}%`
            }
            right={`${lab.architectureReports.length} report(s)`}
          />
          {lab.architectureReports.map((r) => (
            <Row
              key={r.id}
              left={r.clean ? "clean" : "violations present"}
              right={`${(r.integrity * 100).toFixed(0)}% · ${r.createdAt.toISOString().slice(0, 10)}`}
            />
          ))}
        </Panel>

        <Panel title="Proof packets" empty={lab.proofPackets.length === 0}>
          <p className="text-ink-faint">{lab.failedProofCount} failed proof(s) on record.</p>
          {lab.proofPackets.map((p) => (
            <Row
              key={p.id}
              left={`${p.contentType ?? "—"} · ${p.recommendedAction ?? "?"}`}
              right={`${p.proven ? "proven" : "unproven"} · risk ${p.riskLevel}`}
            />
          ))}
        </Panel>

        <Panel title="Active hypotheses" empty={lab.hypotheses.length === 0}>
          {lab.hypotheses.map((h) => (
            <Row key={h.id} left={h.statement} right={`${h.status} · ${h.confidence.toFixed(2)}`} />
          ))}
        </Panel>

        <Panel title="Strategy tournaments" empty={lab.strategyTournaments.length === 0}>
          {lab.strategyTournaments.map((t) => (
            <Row key={t.id} left={t.winner ?? "—"} right={`margin ${t.margin.toFixed(3)}`} />
          ))}
        </Panel>

        <Panel
          title="Benchmark + brain versions"
          empty={lab.benchmarkRuns.length === 0 && lab.brainVersions.length === 0}
        >
          {lab.benchmarkRuns.map((b) => (
            <Row
              key={b.id}
              left={`benchmark ${b.overall.toFixed(3)}${b.regression ? " ⚠ regression" : ""}`}
              right={b.brainVersion ?? ""}
            />
          ))}
          {lab.brainVersions.map((v) => (
            <Row key={v.id} left={`version ${v.version}`} right={`score ${v.score.toFixed(3)}`} />
          ))}
        </Panel>

        <Panel
          title="Capability proposals (review-gated)"
          empty={lab.capabilityProposals.length === 0}
        >
          {lab.capabilityProposals.map((c) => (
            <Row key={c.id} left={c.name} right={`${c.status} · risk ${c.risk.toFixed(2)}`} />
          ))}
        </Panel>

        <Panel title="Adversarial weaknesses" empty={lab.adversarialCases.length === 0}>
          {lab.adversarialCases.map((a) => (
            <Row
              key={a.id}
              left={`${a.name} (${a.targetGate ?? "—"})`}
              right={a.held ? "held" : "WEAKNESS"}
            />
          ))}
        </Panel>

        <Panel title="Counterfactual insights" empty={lab.counterfactualRuns.length === 0}>
          {lab.counterfactualRuns.map((c) => (
            <Row
              key={c.id}
              left={c.bestAlternative ?? "—"}
              right={`regret ${c.regret.toFixed(3)}`}
            />
          ))}
        </Panel>

        <Panel title="Experiments" empty={lab.experimentPlans.length === 0}>
          {lab.experimentPlans.map((e) => (
            <Row key={e.id} left={e.question} right={e.status} />
          ))}
        </Panel>

        <Panel title="Digital twin runs" empty={lab.digitalTwinRuns.length === 0}>
          {lab.digitalTwinRuns.map((d) => (
            <Row
              key={d.id}
              left={`${d.scenarioCount} scenario(s)`}
              right={d.touchesProduction ? "⚠ touched prod" : "isolated"}
            />
          ))}
        </Panel>

        <Panel title="Curriculum progress" empty={lab.curriculumRuns.length === 0}>
          {lab.curriculumRuns.map((c) => (
            <Row
              key={c.id}
              left={`overall ${c.overall.toFixed(2)}`}
              right={c.plateaus.length ? `plateaus: ${c.plateaus.join(", ")}` : "no plateaus"}
            />
          ))}
        </Panel>

        <Panel title="Logic-rule failures" empty={lab.logicRuleFailures.length === 0}>
          {lab.logicRuleFailures.map((r) => (
            <Row key={r.id} left={r.ruleId} right={r.detail ?? ""} />
          ))}
        </Panel>

        <Panel
          title="Claim epistemic statuses"
          empty={Object.keys(lab.claimsByStatus).length === 0}
        >
          {Object.entries(lab.claimsByStatus).map(([status, n]) => (
            <Row key={status} left={status} right={String(n)} />
          ))}
          <p className="text-ink-faint">Ontology gaps: {lab.ontologyGaps}</p>
        </Panel>
      </div>
    </main>
  );
}
