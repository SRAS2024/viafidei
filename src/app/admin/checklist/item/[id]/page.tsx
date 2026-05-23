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
      qaReports: {
        orderBy: { createdAt: "desc" },
        take: 3,
      },
      versions: {
        orderBy: { version: "desc" },
        take: 5,
      },
      relationsFrom: {
        include: { toItem: { select: { canonicalName: true, contentType: true } } },
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

      <section>
        <h2 className="font-display text-xl text-ink">QA reports</h2>
        {item.qaReports.length === 0 ? (
          <p className="mt-2 text-sm text-ink-soft">No QA reports yet.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {item.qaReports.map((r) => (
              <div key={r.id} className="rounded border border-slate-200 bg-white p-3 text-sm">
                <div className="flex justify-between">
                  <span className="font-medium text-ink">
                    {r.recommendation} (score {r.overallScore.toFixed(2)})
                  </span>
                  <span className="text-xs text-ink-soft">{r.createdAt.toISOString()}</span>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-ink-soft">
                  <div>completeness: {r.completenessScore.toFixed(2)}</div>
                  <div>accuracy: {r.accuracyScore.toFixed(2)}</div>
                  <div>source coverage: {r.sourceCoverageScore.toFixed(2)}</div>
                  <div>formatting: {r.formattingScore.toFixed(2)}</div>
                  <div>readability: {r.readabilityScore.toFixed(2)}</div>
                  <div>app compat: {r.appCompatScore.toFixed(2)}</div>
                </div>
                {r.issues.length > 0 && (
                  <div className="mt-2 text-xs text-rose-700">
                    Issues: {r.issues.slice(0, 5).join("; ")}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-display text-xl text-ink">Version history</h2>
        {item.versions.length === 0 ? (
          <p className="mt-2 text-sm text-ink-soft">No versions yet.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {item.versions.map((v) => (
              <li key={v.id} className="rounded border border-slate-200 bg-white px-3 py-2">
                <div>
                  <span className="font-medium">v{v.version}</span> · {v.changeSummary ?? "—"} ·{" "}
                  <span className="text-xs text-ink-soft">{v.createdAt.toISOString()}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-display text-xl text-ink">Relationships</h2>
        {item.relationsFrom.length === 0 ? (
          <p className="mt-2 text-sm text-ink-soft">No relations recorded.</p>
        ) : (
          <ul className="mt-3 space-y-1 text-sm">
            {item.relationsFrom.map((rel) => (
              <li key={rel.id} className="text-ink-soft">
                <span className="rounded bg-slate-100 px-2 py-0.5 text-xs">{rel.relationType}</span>{" "}
                {rel.toItem.canonicalName} ({rel.toItem.contentType})
              </li>
            ))}
          </ul>
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
