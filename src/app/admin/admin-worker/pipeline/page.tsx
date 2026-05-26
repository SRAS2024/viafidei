import { redirect } from "next/navigation";
import Link from "next/link";

import { requireAdmin } from "@/lib/auth/admin";
import { prisma } from "@/lib/db/client";
import { PIPELINE_ORDER, pipelineMapFor } from "@/lib/admin-worker";

export const dynamic = "force-dynamic";

/**
 * Pipeline map (spec §3). Shows the full Discovery → Cache chain
 * for the 30 most-recently-touched items. When ?pipelineKey=… is
 * supplied, renders one item's full per-stage history.
 */
export default async function AdminWorkerPipelinePage({
  searchParams,
}: {
  searchParams: Promise<{ pipelineKey?: string }>;
}) {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");

  const params = await searchParams;
  const pipelineKey = params.pipelineKey ?? null;

  if (pipelineKey) {
    const stages = await pipelineMapFor(prisma, pipelineKey);
    return (
      <div className="space-y-6">
        <header>
          <h1 className="font-display text-3xl text-ink">Pipeline map</h1>
          <p className="mt-1 font-serif text-ink-soft">
            One row per stage for pipelineKey <span className="font-mono">{pipelineKey}</span>.
          </p>
          <Link className="text-indigo-600 underline" href="/admin/admin-worker/pipeline">
            ← back to recent pipeline items
          </Link>
        </header>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left uppercase text-ink-soft">
              <th>Stage</th>
              <th>Status</th>
              <th className="text-right">Confidence</th>
              <th className="text-right">Quality</th>
              <th>Failure reason</th>
              <th>Completed at</th>
            </tr>
          </thead>
          <tbody>
            {stages.map((s) => (
              <tr
                key={s.stage}
                className={`border-t ${
                  s.status === "FAILED" || s.status === "BLOCKED"
                    ? "bg-rose-50"
                    : s.status === "SUCCEEDED"
                      ? "bg-emerald-50"
                      : s.status === "RUNNING"
                        ? "bg-amber-50"
                        : ""
                }`}
              >
                <td className="py-1 font-mono">{s.stage}</td>
                <td className="py-1 font-mono">{s.status}</td>
                <td className="py-1 text-right font-mono">{s.confidenceScore.toFixed(2)}</td>
                <td className="py-1 text-right font-mono">{s.qualityScore.toFixed(2)}</td>
                <td className="py-1 font-serif">{s.failureReason ?? "—"}</td>
                <td className="py-1 font-mono">
                  {s.completedAt ? s.completedAt.toISOString().slice(0, 19) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // No pipelineKey — list the 30 most-recently-touched pipeline items.
  const recent = await prisma.adminWorkerPipelineStage
    .findMany({
      where: { pipelineKey: { not: null } },
      orderBy: { updatedAt: "desc" },
      distinct: ["pipelineKey"],
      take: 30,
      select: {
        pipelineKey: true,
        stageName: true,
        status: true,
        contentType: true,
        updatedAt: true,
        failureReason: true,
      },
    })
    .catch(() => []);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl text-ink">Pipeline (Discovery → Cache)</h1>
        <p className="mt-1 font-serif text-ink-soft">
          Click a pipelineKey to see the full per-stage map for that item.
        </p>
        <div className="mt-2 text-xs font-mono text-ink-soft">
          Order:{" "}
          {PIPELINE_ORDER.map((s, i) => (
            <span key={s}>
              {s}
              {i < PIPELINE_ORDER.length - 1 ? " → " : ""}
            </span>
          ))}
        </div>
      </header>

      {recent.length === 0 ? (
        <p className="text-sm text-ink-soft">
          No pipeline items yet. Run a dispatcher pass to populate.
        </p>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left uppercase text-ink-soft">
              <th>Pipeline key</th>
              <th>Content type</th>
              <th>Latest stage</th>
              <th>Status</th>
              <th>Updated</th>
              <th>Failure</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((r) => (
              <tr key={r.pipelineKey ?? "—"} className="border-t">
                <td className="py-1 font-mono">
                  <Link
                    className="text-indigo-600 underline"
                    href={`/admin/admin-worker/pipeline?pipelineKey=${encodeURIComponent(r.pipelineKey ?? "")}`}
                  >
                    {r.pipelineKey?.slice(0, 30) ?? "—"}
                  </Link>
                </td>
                <td className="py-1 font-mono">{r.contentType ?? "—"}</td>
                <td className="py-1 font-mono">{r.stageName}</td>
                <td className="py-1 font-mono">{r.status}</td>
                <td className="py-1 font-mono">{r.updatedAt.toISOString().slice(0, 19)}</td>
                <td className="py-1 font-serif">{r.failureReason ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
