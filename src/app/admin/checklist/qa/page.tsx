import { redirect } from "next/navigation";
import Link from "next/link";

import { requireAdmin } from "@/lib/auth/admin";
import { prisma } from "@/lib/db/client";

export const dynamic = "force-dynamic";

export default async function QADashboard({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");

  const { filter } = await searchParams;

  const reports = await prisma.adminWorkerStrictQAResult.findMany({
    where: filter === "review" ? { status: "NEEDS_REPAIR" } : {},
    orderBy: [{ finalScore: "asc" }, { createdAt: "desc" }],
    take: 100,
  });

  return (
    <div className="space-y-6">
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="font-display text-3xl text-ink">Strict QA results</h1>
          <p className="mt-1 font-serif text-ink-soft">
            {reports.length} result(s) from the STRICT_QA stage. Sorted by final score.
          </p>
        </div>
        <Link className="text-sm text-indigo-600 underline" href="/admin/checklist">
          ← dashboard
        </Link>
      </header>

      <table className="w-full table-auto border-collapse text-sm">
        <thead>
          <tr className="bg-slate-50 text-left">
            <th className="border-b px-3 py-2">Type</th>
            <th className="border-b px-3 py-2">Score</th>
            <th className="border-b px-3 py-2">Status</th>
            <th className="border-b px-3 py-2">Blocking reasons</th>
          </tr>
        </thead>
        <tbody>
          {reports.map((report) => (
            <tr key={report.id} className="border-b">
              <td className="px-3 py-2 text-ink-soft">{report.contentType}</td>
              <td className="px-3 py-2">
                <span
                  className={`rounded px-2 py-0.5 text-xs ${
                    report.finalScore >= 0.8
                      ? "bg-green-100 text-green-800"
                      : report.finalScore >= 0.6
                        ? "bg-amber-100 text-amber-800"
                        : "bg-rose-100 text-rose-800"
                  }`}
                >
                  {report.finalScore.toFixed(2)}
                </span>
              </td>
              <td className="px-3 py-2 text-ink-soft">
                {report.status}
                {report.status === "NEEDS_REPAIR" && (
                  <span className="ml-2 inline-block rounded bg-purple-100 px-2 py-0.5 text-xs text-purple-800">
                    needs repair
                  </span>
                )}
              </td>
              <td className="px-3 py-2 text-xs text-rose-700 max-w-md">
                {report.blockingReasons.slice(0, 3).join("; ") || "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
