import { redirect } from "next/navigation";
import Link from "next/link";

import { requireAdmin } from "@/lib/auth/admin";
import { prisma } from "@/lib/db/client";

export const dynamic = "force-dynamic";

export default async function PublishedItems() {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");

  const items = await prisma.publishedContent.findMany({
    where: { isPublished: true },
    orderBy: [{ contentType: "asc" }, { title: "asc" }],
    take: 200,
  });

  return (
    <div className="space-y-6">
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="font-display text-3xl text-ink">Published content</h1>
          <p className="mt-1 font-serif text-ink-soft">
            {items.length} live item(s). Click an item to view, unpublish, or rebuild.
          </p>
        </div>
        <Link className="text-sm text-indigo-600 underline" href="/admin/checklist">
          ← dashboard
        </Link>
      </header>

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
    </div>
  );
}
