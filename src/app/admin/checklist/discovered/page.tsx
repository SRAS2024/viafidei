import { redirect } from "next/navigation";
import Link from "next/link";

import { requireAdmin } from "@/lib/auth/admin";
import { prisma } from "@/lib/db/client";
import type { ChecklistApprovalStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function DiscoveredItems({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");

  const { status } = await searchParams;
  const filterStatus = ((status as ChecklistApprovalStatus) ??
    "DISCOVERED") as ChecklistApprovalStatus;

  const items = await prisma.checklistItem.findMany({
    where: { approvalStatus: filterStatus },
    orderBy: [{ priority: "asc" }, { canonicalName: "asc" }],
    take: 200,
    include: {
      citations: {
        select: {
          id: true,
          sourceUrl: true,
          sourceHost: true,
          authorityLevel: true,
          validated: true,
        },
      },
    },
  });

  return (
    <div className="space-y-6">
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="font-display text-3xl text-ink">
            {filterStatus.replace(/_/g, " ").toLowerCase()} items
          </h1>
          <p className="mt-1 font-serif text-ink-soft">
            {items.length} item(s). Add citations and promote items to source_verified, then approve
            for build.
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
            <th className="border-b px-3 py-2">Priority</th>
            <th className="border-b px-3 py-2">Citations</th>
            <th className="border-b px-3 py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-b">
              <td className="px-3 py-2">
                <div className="font-medium text-ink">{item.canonicalName}</div>
                <div className="text-xs text-ink-soft">{item.canonicalSlug}</div>
                {item.needsHumanReview && (
                  <div className="mt-1 inline-block rounded bg-purple-100 px-2 py-0.5 text-xs text-purple-800">
                    needs review
                  </div>
                )}
              </td>
              <td className="px-3 py-2 text-ink-soft">{item.contentType}</td>
              <td className="px-3 py-2 text-ink-soft">{item.priority}</td>
              <td className="px-3 py-2">
                {item.citations.length === 0 ? (
                  <span className="text-rose-600">none</span>
                ) : (
                  <ul className="space-y-0.5 text-xs">
                    {item.citations.map((c) => (
                      <li key={c.id}>
                        <span
                          className={`mr-1 rounded px-1 py-0.5 text-[10px] ${
                            c.validated
                              ? "bg-green-100 text-green-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {c.authorityLevel}
                        </span>
                        {c.sourceHost}
                      </li>
                    ))}
                  </ul>
                )}
              </td>
              <td className="px-3 py-2">
                <Link
                  className="text-indigo-600 underline"
                  href={`/admin/checklist/item/${item.id}`}
                >
                  manage
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
