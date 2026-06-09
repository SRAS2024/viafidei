import Link from "next/link";
import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/auth/admin";
import { prisma } from "@/lib/db/client";
import {
  collectSkillCapabilityData,
  refreshCapabilityMatrix,
  ensureSkillsRegistered,
  listSkills,
} from "@/lib/admin-worker/skills";

export const dynamic = "force-dynamic";

/**
 * Certified Admin Skill Runtime dashboard. Honestly answers "what can the
 * worker actually do right now?": the final-brain state, the certified-skill
 * catalogue, the capability coverage matrix (certified / partial / missing /
 * review-gated), recent skill executions from the durable ledger, and the
 * content types/subtypes that are blocked because no certified skill exists yet.
 */

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="vf-card rounded-sm p-5">
      <h2 className="font-display text-lg text-ink">{title}</h2>
      <div className="mt-3 space-y-1.5 text-sm">{children}</div>
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

const STATUS_TONE: Record<string, string> = {
  CERTIFIED: "text-emerald-700",
  REQUIRES_HUMAN_REVIEW: "text-amber-700",
  PARTIAL: "text-amber-700",
  MISSING: "text-rose-700",
  BLOCKED: "text-rose-700",
  REQUIRES_DEVELOPER_WORK: "text-rose-700",
};

export default async function SkillsPage() {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");

  ensureSkillsRegistered();
  // Keep the matrix current each time an admin looks (best-effort).
  await refreshCapabilityMatrix(prisma).catch(() => undefined);
  const data = await collectSkillCapabilityData(prisma, { limit: 15 });

  const latestDecided = await prisma.adminWorkerLog
    .findFirst({
      where: { eventName: "brain_decided" },
      orderBy: { createdAt: "desc" },
      select: { safeMetadata: true },
    })
    .catch(() => null);
  const finalBrain =
    (latestDecided?.safeMetadata as { finalBrain?: string } | null)?.finalBrain ?? null;
  const brainState =
    finalBrain === "python"
      ? "PYTHON_FINAL_BRAIN_ACTIVE"
      : finalBrain == null
        ? "UNKNOWN (no pass recorded yet)"
        : "PYTHON_BRAIN_UNAVAILABLE_SAFE_DEGRADED_MODE";

  const skills = listSkills();
  const buildRows = data.rows.filter(
    (r) => r.capability.startsWith("build:") && !r.capability.includes(":", 6),
  );
  const missingBuild = buildRows.filter((r) => r.coverageStatus === "MISSING");

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
      <div className="flex items-baseline justify-between">
        <div>
          <p className="vf-eyebrow text-ink-faint">Admin Worker</p>
          <h1 className="mt-1 font-display text-3xl text-ink">Certified Admin Skill Runtime</h1>
        </div>
        <Link href="/admin/intelligence" className="vf-nav-link text-sm">
          ← Intelligence
        </Link>
      </div>
      <p className="mt-2 font-serif text-sm text-ink-soft">
        The worker performs all autonomous operational work through certified skills — each with
        preflight, execution, verification, rollback, and a durable ledger entry. This page reports
        actual capability honestly: anything not backed by a certified skill is shown as MISSING and
        the worker files a developer request rather than pretending it can do it.
      </p>

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <Panel title="Final decision brain">
          <Row
            left={brainState}
            right={brainState.startsWith("PYTHON_FINAL") ? "active" : "degraded / unknown"}
          />
          <p className="text-ink-faint">
            Autonomous publishing only runs when the Python final brain is active. In safe degraded
            mode the worker does security, diagnostics, reporting, maintenance, and known-safe
            repair only.
          </p>
        </Panel>

        <Panel title="Coverage summary">
          <Row left="Certified capabilities" right={String(data.certified)} />
          <Row left="Missing capabilities" right={String(data.missing)} />
          <Row left="Blocked capabilities" right={String(data.blocked)} />
          <Row left="Certified skills registered" right={String(skills.length)} />
          <Row left="Skill executions on record" right={String(data.totalExecutions)} />
        </Panel>

        <Panel title="Content type coverage">
          {buildRows.length === 0 ? (
            <p className="text-ink-faint">No coverage computed yet.</p>
          ) : (
            buildRows.map((r) => (
              <div
                key={r.capability}
                className="flex justify-between gap-3 rounded border border-stone-200 px-3 py-1.5"
              >
                <span className="text-ink">{r.contentType}</span>
                <span
                  className={`font-mono text-xs ${STATUS_TONE[r.coverageStatus] ?? "text-ink-soft"}`}
                >
                  {r.coverageStatus}
                </span>
              </div>
            ))
          )}
        </Panel>

        <Panel title="Blocked — no certified skill yet (developer requests filed)">
          {missingBuild.length === 0 ? (
            <p className="text-ink-faint">Every catalogued content type has a certified builder.</p>
          ) : (
            missingBuild.map((r) => (
              <Row key={r.capability} left={r.contentType ?? r.capability} right="MISSING" />
            ))
          )}
        </Panel>

        <Panel title="Certified skills">
          {skills.map((s) => (
            <Row
              key={s.name}
              left={s.name}
              right={`${s.category.toLowerCase()} · ${s.riskLevel}${s.humanReviewRequired ? " · review" : ""}`}
            />
          ))}
        </Panel>

        <Panel title="Recent skill executions (ledger)">
          {data.recentExecutions.length === 0 ? (
            <p className="text-ink-faint">No skill executions recorded yet.</p>
          ) : (
            data.recentExecutions.map((e, i) => (
              <Row
                key={`${e.skillName}-${i}`}
                left={`${e.skillName}${e.contentType ? ` · ${e.contentType}` : ""}`}
                right={`${e.executionStatus} / ${e.verificationStatus}`}
              />
            ))
          )}
        </Panel>
      </div>
    </main>
  );
}
