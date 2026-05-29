import { redirect } from "next/navigation";
import Link from "next/link";

import { requireAdmin } from "@/lib/auth/admin";
import { prisma } from "@/lib/db/client";

export const dynamic = "force-dynamic";

/**
 * Package artifact detail view (spec §12.13.4 / §21). Lists
 * AdminWorkerPackageArtifact rows with their strict-QA result so the
 * operator can see — per artifact — its status, confidence, missing
 * fields, validation needs, and exactly why strict QA passed, needs
 * repair, or rejected it. When ?id=… is supplied, renders one
 * artifact's full detail.
 */
export default async function AdminWorkerArtifactsPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");

  const params = await searchParams;
  const id = params.id ?? null;

  if (id) {
    const artifact = await prisma.adminWorkerPackageArtifact
      .findUnique({ where: { id } })
      .catch(() => null);
    const qa = await prisma.adminWorkerStrictQAResult
      .findUnique({ where: { packageArtifactId: id } })
      .catch(() => null);
    if (!artifact) {
      return (
        <div className="space-y-4">
          <h1 className="font-display text-3xl text-ink">Package artifact</h1>
          <p className="font-serif text-ink-soft">No artifact found for id {id}.</p>
          <Link className="text-indigo-600 underline" href="/admin/admin-worker/artifacts">
            ← back to artifacts
          </Link>
        </div>
      );
    }
    return (
      <div className="space-y-6">
        <header>
          <h1 className="font-display text-3xl text-ink">Package artifact detail</h1>
          <Link className="text-indigo-600 underline" href="/admin/admin-worker/artifacts">
            ← back to artifacts
          </Link>
        </header>

        <article className="rounded border bg-white p-4 shadow-sm">
          <h2 className="font-display text-xl text-ink">Artifact</h2>
          <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm md:grid-cols-4">
            <dt className="text-ink-soft">Content type</dt>
            <dd className="font-mono">{artifact.contentType}</dd>
            <dt className="text-ink-soft">Status</dt>
            <dd className="font-mono">{artifact.status}</dd>
            <dt className="text-ink-soft">Title</dt>
            <dd className="font-mono">{artifact.normalizedTitle}</dd>
            <dt className="text-ink-soft">Slug</dt>
            <dd className="font-mono">{artifact.normalizedSlug}</dd>
            <dt className="text-ink-soft">Confidence</dt>
            <dd className="font-mono">{artifact.confidenceScore.toFixed(2)}</dd>
            <dt className="text-ink-soft">Checksum</dt>
            <dd className="truncate font-mono">{artifact.packageChecksum}</dd>
            <dt className="text-ink-soft">Missing fields</dt>
            <dd className="font-mono">{artifact.missingFields.join(", ") || "none"}</dd>
            <dt className="text-ink-soft">Validation needs</dt>
            <dd className="font-mono">{artifact.validationNeeds.join(", ") || "none"}</dd>
            <dt className="text-ink-soft">Rejection reason</dt>
            <dd className="font-serif md:col-span-3">{artifact.rejectionReason ?? "—"}</dd>
            <dt className="text-ink-soft">Repair suggestions</dt>
            <dd className="font-serif md:col-span-3">
              {artifact.repairSuggestions.join("; ") || "—"}
            </dd>
          </dl>
        </article>

        <article className="rounded border bg-white p-4 shadow-sm">
          <h2 className="font-display text-xl text-ink">Strict QA result (spec §12)</h2>
          {qa ? (
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm md:grid-cols-4">
              <dt className="text-ink-soft">Status</dt>
              <dd className="font-mono">{qa.status}</dd>
              <dt className="text-ink-soft">Final score</dt>
              <dd className="font-mono">{qa.finalScore.toFixed(2)}</dd>
              <dt className="text-ink-soft">Completeness</dt>
              <dd className="font-mono">{qa.completenessScore.toFixed(2)}</dd>
              <dt className="text-ink-soft">Correctness</dt>
              <dd className="font-mono">{qa.correctnessScore.toFixed(2)}</dd>
              <dt className="text-ink-soft">Formatting</dt>
              <dd className="font-mono">{qa.formattingScore.toFixed(2)}</dd>
              <dt className="text-ink-soft">Provenance</dt>
              <dd className="font-mono">{qa.provenanceScore.toFixed(2)}</dd>
              <dt className="text-ink-soft">Validation</dt>
              <dd className="font-mono">{qa.validationScore.toFixed(2)}</dd>
              <dt className="text-ink-soft">Duplicate safety</dt>
              <dd className="font-mono">{qa.duplicateSafetyScore.toFixed(2)}</dd>
              <dt className="text-ink-soft">Public readiness</dt>
              <dd className="font-mono">{qa.publicReadinessScore.toFixed(2)}</dd>
              <dt className="text-ink-soft">Blocking reasons</dt>
              <dd className="font-serif md:col-span-3">
                {qa.blockingReasons.join("; ") || "none"}
              </dd>
              <dt className="text-ink-soft">Repair suggestions</dt>
              <dd className="font-serif md:col-span-3">{qa.repairSuggestions.join("; ") || "—"}</dd>
            </dl>
          ) : (
            <p className="mt-2 text-sm italic text-ink-soft">
              No strict-QA result yet. The STRICT_QA dispatcher stage scores BUILD_READY artifacts.
            </p>
          )}
        </article>
      </div>
    );
  }

  // List view — most recent artifacts with their strict-QA status.
  const artifacts = await prisma.adminWorkerPackageArtifact
    .findMany({ orderBy: { createdAt: "desc" }, take: 50 })
    .catch(() => []);
  const qaRows = await prisma.adminWorkerStrictQAResult
    .findMany({
      where: { packageArtifactId: { in: artifacts.map((a) => a.id) } },
      select: { packageArtifactId: true, status: true, finalScore: true },
    })
    .catch(() => [] as Array<{ packageArtifactId: string; status: string; finalScore: number }>);
  const qaByArtifact = new Map(qaRows.map((q) => [q.packageArtifactId, q]));

  return (
    <div className="space-y-6">
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="font-display text-3xl text-ink">Package artifacts</h1>
          <p className="mt-1 font-serif text-ink-soft">
            Every built package + its strict-QA result. Click an id for full detail.
          </p>
        </div>
        <Link className="text-indigo-600 underline" href="/admin/admin-worker">
          ← command center
        </Link>
      </header>

      {artifacts.length === 0 ? (
        <p className="rounded border border-dashed border-slate-300 p-4 text-sm italic text-ink-soft">
          No package artifacts yet. The EXTRACTION dispatcher stage materialises them.
        </p>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left uppercase text-ink-soft">
              <th className="py-1">Artifact</th>
              <th>Type</th>
              <th>Title</th>
              <th>Status</th>
              <th className="text-right">Conf.</th>
              <th>Strict QA</th>
              <th className="text-right">QA score</th>
            </tr>
          </thead>
          <tbody>
            {artifacts.map((a) => {
              const qa = qaByArtifact.get(a.id);
              return (
                <tr key={a.id} className="border-t">
                  <td className="py-1 font-mono">
                    <Link
                      className="text-indigo-600 underline"
                      href={`/admin/admin-worker/artifacts?id=${a.id}`}
                    >
                      {a.id.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="py-1 font-mono">{a.contentType}</td>
                  <td className="py-1">{a.normalizedTitle.slice(0, 40)}</td>
                  <td className="py-1 font-mono">{a.status}</td>
                  <td className="py-1 text-right font-mono">{a.confidenceScore.toFixed(2)}</td>
                  <td className="py-1 font-mono">{qa?.status ?? "—"}</td>
                  <td className="py-1 text-right font-mono">
                    {qa ? qa.finalScore.toFixed(2) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
