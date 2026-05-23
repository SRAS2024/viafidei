import { redirect } from "next/navigation";
import Link from "next/link";

import { requireAdmin } from "@/lib/auth/admin";
import { prisma } from "@/lib/db/client";

export const dynamic = "force-dynamic";

export default async function WorkerQueuePage() {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");

  const jobs = await prisma.workerBuildJob.findMany({
    where: { status: { in: ["pending", "running", "retrying", "partial"] } },
    orderBy: [{ priority: "asc" }, { runAt: "asc" }],
    take: 200,
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
          <h1 className="font-display text-3xl text-ink">Worker build queue</h1>
          <p className="mt-1 font-serif text-ink-soft">
            {jobs.length} live build job(s). Failed jobs surface in{" "}
            <Link href="/admin/checklist/failed" className="underline text-indigo-600">
              Failed builds
            </Link>
            .
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
            <th className="border-b px-3 py-2">Status</th>
            <th className="border-b px-3 py-2">Attempt</th>
            <th className="border-b px-3 py-2">Run at</th>
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
              <td className="px-3 py-2">
                <span
                  className={`rounded px-2 py-0.5 text-xs ${
                    job.status === "running"
                      ? "bg-blue-100 text-blue-800"
                      : job.status === "retrying"
                        ? "bg-amber-100 text-amber-800"
                        : job.status === "partial"
                          ? "bg-purple-100 text-purple-800"
                          : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {job.status}
                </span>
              </td>
              <td className="px-3 py-2 text-ink-soft">
                {job.attempt}/{job.maxAttempts}
              </td>
              <td className="px-3 py-2 text-xs text-ink-soft">{job.runAt.toISOString()}</td>
              <td className="px-3 py-2 text-xs text-rose-700 max-w-xs truncate">
                {job.errorMessage ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
