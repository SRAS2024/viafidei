import { redirect } from "next/navigation";
import Link from "next/link";

import { requireAdmin } from "@/lib/auth/admin";
import { prisma } from "@/lib/db/client";
import { FilterChips } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function PublishedItems({
  searchParams,
}: {
  searchParams: Promise<{ contentType?: string }>;
}) {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");

  const { contentType } = await searchParams;

  // Counts per content type for the filter chips (every type the worker has
  // published), plus the grand total — so the console manages content for ALL
  // content types, filterable to each one.
  const grouped = await prisma.publishedContent.groupBy({
    by: ["contentType"],
    where: { isPublished: true },
    _count: { _all: true },
  });
  const byType = grouped
    .map((g) => ({ type: g.contentType, count: g._count._all }))
    .sort((a, b) => a.type.localeCompare(b.type));
  const total = byType.reduce((sum, t) => sum + t.count, 0);
  // Validate the requested type against what actually exists (keeps the typed
  // enum for the query); unknown/absent → "all".
  const activeType = byType.find((t) => t.type === contentType)?.type;
  const active = activeType ?? "all";

  const items = await prisma.publishedContent.findMany({
    where: { isPublished: true, ...(activeType ? { contentType: activeType } : {}) },
    orderBy: [{ contentType: "asc" }, { title: "asc" }],
    take: 500,
  });

  return (
    <div className="space-y-6">
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="font-display text-3xl text-ink">Published content</h1>
          <p className="mt-1 font-serif text-ink-soft">
            {items.length} live item(s)
            {active !== "all" ? ` of type ${active}` : ` across ${byType.length} content types`}.
            Click an item to view, unpublish, or rebuild.
          </p>
        </div>
        <Link className="text-sm text-indigo-600 underline" href="/admin/checklist">
          ← dashboard
        </Link>
      </header>

      {/* Filter the management view by content type — every type the worker
          publishes appears here with its live count. */}
      <FilterChips
        ariaLabel="Filter published content by type"
        activeKey={active}
        items={[
          { key: "all", label: "All", count: total, href: "/admin/checklist/published" },
          ...byType.map((t) => ({
            key: t.type,
            label: t.type,
            count: t.count,
            href: `/admin/checklist/published?contentType=${t.type}`,
          })),
        ]}
      />

      {items.length === 0 ? (
        <p className="rounded border border-slate-200 bg-white px-4 py-6 text-center font-serif text-ink-soft">
          No published content for this type yet.
        </p>
      ) : (
        <table className="w-full table-auto border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50 text-left">
              <th className="border-b px-3 py-2">Title</th>
              <th className="border-b px-3 py-2">Type</th>
              <th className="border-b px-3 py-2">Authority</th>
              <th className="border-b px-3 py-2">Version</th>
              <th className="border-b px-3 py-2">Published at</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b">
                <td className="px-3 py-2">
                  <Link
                    href={`/admin/checklist/item/${item.checklistItemId}`}
                    className="underline text-ink"
                  >
                    {item.title}
                  </Link>
                  <div className="text-xs text-ink-soft">{item.slug}</div>
                </td>
                <td className="px-3 py-2 text-ink-soft">{item.contentType}</td>
                <td className="px-3 py-2 text-ink-soft">{item.authorityLevel}</td>
                <td className="px-3 py-2 text-ink-soft">v{item.version}</td>
                <td className="px-3 py-2 text-xs text-ink-soft">
                  {item.publishedAt?.toISOString() ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
