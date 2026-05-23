import { redirect } from "next/navigation";
import Link from "next/link";

import { requireAdmin } from "@/lib/auth/admin";
import { prisma } from "@/lib/db/client";

export const dynamic = "force-dynamic";

export default async function FailedBuilds() {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");

  const jobs = await prisma.workerBuildJob.findMany({
    where: { status: "failed" },
    orderBy: { updatedAt: "desc" },
    take: 100,
    include: {
      checklistItem: {
        select: { canonicalName: true, contentType: true, canonicalSlug: true },
      },
    },
  });

  return (
    <div className="space-y-6">
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="font-display text-3xl text-ink">Failed builds</h1>
          <p className="mt-1 font-serif text-ink-soft">
            {jobs.length} build job(s) exhausted their retries. Inspect the error and retry
            manually, or correct the citation/source list before re-approving.
          </p>
        </div>
        <Link className="text-sm text-indigo-600 underline" href="/admin/checklist">
          ← dashboard
        </Link>
      </header>

      <table className="w-full table-auto border-collapse text-sm">
        <thead>
          <tr className="bg-slate-50 text-left">
            <th className="border-b px-3 py-2">Item</th>
            <th className="border-b px-3 py-2">Type</th>
            <th className="border-b px-3 py-2">Attempts</th>
            <th className="border-b px-3 py-2">Error</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <tr key={job.id} className="border-b">
              <td className="px-3 py-2">
                <Link
                  href={`/admin/checklist/item/${job.checklistItemId}`}
                  className="underline text-ink"
                >
                  {job.checklistItem.canonicalName}
                </Link>
                <div className="text-xs text-ink-soft">{job.checklistItem.canonicalSlug}</div>
              </td>
              <td className="px-3 py-2 text-ink-soft">{job.checklistItem.contentType}</td>
              <td className="px-3 py-2 text-ink-soft">
                {job.attempt}/{job.maxAttempts}
              </td>
              <td className="px-3 py-2 text-xs text-rose-700 max-w-md break-words">
                {job.errorMessage ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
