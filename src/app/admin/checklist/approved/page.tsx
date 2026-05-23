import { redirect } from "next/navigation";
import Link from "next/link";

import { requireAdmin } from "@/lib/auth/admin";
import { prisma } from "@/lib/db/client";

export const dynamic = "force-dynamic";

export default async function ApprovedForBuild() {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");

  const items = await prisma.checklistItem.findMany({
    where: { approvalStatus: "APPROVED_FOR_BUILD" },
    orderBy: [{ priority: "asc" }, { canonicalName: "asc" }],
    take: 200,
    include: {
      buildJobs: {
        orderBy: { attempt: "desc" },
        take: 1,
        select: { status: true, attempt: true, maxAttempts: true, errorMessage: true },
      },
      citations: { select: { id: true } },
    },
  });

  return (
    <div className="space-y-6">
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="font-display text-3xl text-ink">Approved for build</h1>
          <p className="mt-1 font-serif text-ink-soft">
            {items.length} item(s) waiting for the worker. The worker drains in priority order.
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
            <th className="border-b px-3 py-2">Citations</th>
            <th className="border-b px-3 py-2">Last attempt</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const last = item.buildJobs[0];
            return (
              <tr key={item.id} className="border-b">
                <td className="px-3 py-2">
                  <Link
                    href={`/admin/checklist/item/${item.id}`}
                    className="font-medium text-ink underline"
                  >
                    {item.canonicalName}
                  </Link>
                  <div className="text-xs text-ink-soft">{item.canonicalSlug}</div>
                </td>
                <td className="px-3 py-2 text-ink-soft">{item.contentType}</td>
                <td className="px-3 py-2 text-ink-soft">{item.citations.length}</td>
                <td className="px-3 py-2 text-ink-soft">
                  {last ? `${last.status} (attempt ${last.attempt}/${last.maxAttempts})` : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
