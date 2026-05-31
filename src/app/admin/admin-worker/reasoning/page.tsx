import { redirect } from "next/navigation";
import Link from "next/link";

import { requireAdmin } from "@/lib/auth/admin";
import { prisma } from "@/lib/db/client";
import { getReasoningChain, listReasoningChains } from "@/lib/admin-worker";

export const dynamic = "force-dynamic";

/**
 * Worker Reasoning (spec §46-48). Shows the full reasoning chain for any
 * content item: every edge the worker recorded, with the explanation of
 * *why* one thing led to another (candidate selected because source
 * reputation was high; artifact rejected because prayer text was
 * missing; source paused because QA failures exceeded threshold; repair
 * selected because validation evidence was missing; publish allowed
 * because strict QA and quality score passed). The worker never makes an
 * important decision that cannot be explained here later.
 *
 * Without a query param it lists the most recent reasoning chains as a
 * pick-list. With ?pipelineKey=… (or ?contentType=…&contentId=…) it
 * renders that item's full chain.
 */
export default async function AdminWorkerReasoningPage({
  searchParams,
}: {
  searchParams: Promise<{ pipelineKey?: string; contentType?: string; contentId?: string }>;
}) {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");

  const params = await searchParams;
  const pipelineKey = params.pipelineKey ?? null;
  const contentType = params.contentType ?? null;
  const contentId = params.contentId ?? null;

  if (pipelineKey || (contentType && contentId)) {
    const chain = await getReasoningChain(prisma, { pipelineKey, contentType, contentId });
    return (
      <div className="space-y-6">
        <header>
          <h1 className="font-display text-3xl text-ink">Worker Reasoning</h1>
          <p className="mt-1 font-serif text-ink-soft">
            Full reasoning chain for{" "}
            <span className="font-mono">
              {pipelineKey ?? `${contentType}:${contentId}`}
            </span>
            . Each edge explains why one thing led to another.
          </p>
          <Link className="text-indigo-600 underline" href="/admin/admin-worker/reasoning">
            ← back to recent reasoning chains
          </Link>
        </header>

        {chain.edges.length === 0 ? (
          <p className="text-sm text-ink-soft">
            No reasoning edges recorded for this item yet. The worker records edges as it advances
            the item through the pipeline.
          </p>
        ) : (
          <section className="rounded border bg-white p-4 shadow-sm">
            <h2 className="font-display text-xl text-ink">Chain ({chain.edges.length} edges)</h2>
            <ol className="mt-3 space-y-2">
              {chain.edges.map((e) => (
                <li key={e.id} className="rounded border-l-4 border-indigo-300 bg-slate-50 px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                    <span className="rounded bg-slate-200 px-1.5 py-0.5">{e.from.type}</span>
                    {e.from.label && <span className="text-ink-soft">{e.from.label.slice(0, 40)}</span>}
                    <span className="text-indigo-700">—{e.relation}→</span>
                    <span className="rounded bg-slate-200 px-1.5 py-0.5">{e.to.type}</span>
                    {e.to.label && <span className="text-ink-soft">{e.to.label.slice(0, 40)}</span>}
                  </div>
                  <p className="mt-1 font-serif text-sm text-ink">{e.explanation}</p>
                  <p className="mt-0.5 text-[10px] font-mono text-ink-soft">
                    confidence {e.confidence.toFixed(2)} · {e.createdAt.toISOString().slice(0, 19)}
                  </p>
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>
    );
  }

  const chains = await listReasoningChains(prisma, { limit: 40 });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl text-ink">Worker Reasoning</h1>
        <p className="mt-1 font-serif text-ink-soft">
          Pick a content item to see the full chain of why the worker did what it did. Spec §46-48:
          the worker never makes an important decision that cannot be explained later.
        </p>
        <Link className="text-indigo-600 underline" href="/admin/admin-worker">
          ← Command Center
        </Link>
      </header>

      {chains.length === 0 ? (
        <p className="text-sm text-ink-soft">
          No reasoning chains yet. Run a worker pass — the brain records an edge for every decision,
          and each pipeline stage records why it advanced or blocked.
        </p>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left uppercase text-ink-soft">
              <th>Item</th>
              <th>Content type</th>
              <th>Label</th>
              <th className="text-right">Edges</th>
              <th>Last activity</th>
            </tr>
          </thead>
          <tbody>
            {chains.map((c) => {
              const href = c.pipelineKey
                ? `/admin/admin-worker/reasoning?pipelineKey=${encodeURIComponent(c.pipelineKey)}`
                : `/admin/admin-worker/reasoning?contentType=${encodeURIComponent(
                    c.contentType ?? "",
                  )}&contentId=${encodeURIComponent(c.contentId ?? "")}`;
              return (
                <tr key={`${c.pipelineKey ?? ""}:${c.contentId ?? ""}`} className="border-t">
                  <td className="py-1 font-mono">
                    <Link className="text-indigo-600 underline" href={href}>
                      {(c.pipelineKey ?? c.contentId ?? "—").slice(0, 32)}
                    </Link>
                  </td>
                  <td className="py-1 font-mono">{c.contentType ?? "—"}</td>
                  <td className="py-1 font-serif">{c.label?.slice(0, 48) ?? "—"}</td>
                  <td className="py-1 text-right font-mono">{c.edgeCount}</td>
                  <td className="py-1 font-mono">{c.lastActivity.toISOString().slice(0, 19)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
