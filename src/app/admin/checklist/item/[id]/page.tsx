import { redirect, notFound } from "next/navigation";
import Link from "next/link";

import { requireAdmin } from "@/lib/auth/admin";
import { prisma } from "@/lib/db/client";
import { ItemActionsClient } from "./ItemActionsClient";

export const dynamic = "force-dynamic";

export default async function ChecklistItemDetail({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");

  const { id } = await params;
  const item = await prisma.checklistItem.findUnique({
    where: { id },
    include: {
      citations: {
        orderBy: { authorityLevel: "asc" },
      },
      buildJobs: {
        orderBy: { attempt: "desc" },
        take: 5,
      },
    },
  });
  if (!item) notFound();

  const published = await prisma.publishedContent.findUnique({
    where: { checklistItemId: id },
  });

  return (
    <div className="space-y-8">
      <header>
        <Link className="text-sm text-indigo-600 underline" href="/admin/checklist">
          ← dashboard
        </Link>
        <h1 className="mt-2 font-display text-3xl text-ink">{item.canonicalName}</h1>
        <p className="mt-1 font-serif text-ink-soft">
          {item.contentType} · slug:{" "}
          <code className="px-1 py-0.5 bg-slate-100 rounded">{item.canonicalSlug}</code>
        </p>
        <p className="mt-2">
          <span
            className={`rounded px-2 py-1 text-xs ${
              item.approvalStatus === "PUBLISHED"
                ? "bg-green-100 text-green-800"
                : item.approvalStatus === "REJECTED"
                  ? "bg-rose-100 text-rose-800"
                  : "bg-indigo-100 text-indigo-800"
            }`}
          >
            {item.approvalStatus}
          </span>
          {item.needsHumanReview && (
            <span className="ml-2 rounded bg-purple-100 px-2 py-1 text-xs text-purple-800">
              needs human review
            </span>
          )}
        </p>
        {item.humanReviewReason && (
          <p className="mt-2 rounded border border-purple-200 bg-purple-50 px-3 py-2 text-sm text-purple-900">
            Review reason: {item.humanReviewReason}
          </p>
        )}
      </header>

      <ItemActionsClient itemId={item.id} status={item.approvalStatus} />

      <section>
        <h2 className="font-display text-xl text-ink">Citations</h2>
        {item.citations.length === 0 ? (
          <p className="mt-2 text-sm text-rose-600">
            No citations yet. Add at least one before approving for build.
          </p>
        ) : (
          <table className="mt-3 w-full table-auto border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 text-left">
                <th className="border-b px-3 py-2">URL</th>
                <th className="border-b px-3 py-2">Authority</th>
                <th className="border-b px-3 py-2">Validated</th>
              </tr>
            </thead>
            <tbody>
              {item.citations.map((c) => (
                <tr key={c.id} className="border-b">
                  <td className="px-3 py-2">
                    <a className="text-indigo-600 underline break-all" href={c.sourceUrl}>
                      {c.sourceUrl}
                    </a>
                  </td>
                  <td className="px-3 py-2 text-xs text-ink-soft">{c.authorityLevel}</td>
                  <td className="px-3 py-2 text-xs">
                    {c.validated ? "✓" : <span className="text-amber-600">pending</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h2 className="font-display text-xl text-ink">Build jobs</h2>
        {item.buildJobs.length === 0 ? (
          <p className="mt-2 text-sm text-ink-soft">No build jobs yet.</p>
        ) : (
          <table className="mt-3 w-full table-auto border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 text-left">
                <th className="border-b px-3 py-2">Attempt</th>
                <th className="border-b px-3 py-2">Status</th>
                <th className="border-b px-3 py-2">Confidence</th>
                <th className="border-b px-3 py-2">Error</th>
              </tr>
            </thead>
            <tbody>
              {item.buildJobs.map((job) => (
                <tr key={job.id} className="border-b">
                  <td className="px-3 py-2 text-ink-soft">
                    {job.attempt}/{job.maxAttempts}
                  </td>
                  <td className="px-3 py-2 text-ink-soft">{job.status}</td>
                  <td className="px-3 py-2 text-ink-soft">{job.confidence?.toFixed(2) ?? "—"}</td>
                  <td className="px-3 py-2 text-xs text-rose-700 max-w-xs truncate">
                    {job.errorMessage ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {published && (
        <section>
          <h2 className="font-display text-xl text-ink">Published payload</h2>
          <pre className="mt-3 max-h-96 overflow-auto rounded border border-slate-200 bg-slate-50 p-3 text-xs">
            {JSON.stringify(published.payload, null, 2)}
          </pre>
        </section>
      )}
    </div>
  );
}
