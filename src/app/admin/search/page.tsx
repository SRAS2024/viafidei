import { redirect } from "next/navigation";
import Link from "next/link";

import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { AdminSection } from "../_sections/AdminSection";

export const dynamic = "force-dynamic";

export default async function AdminSearchPanel() {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");

  const [total, byType] = await Promise.all([
    prisma.publishedContent.count({ where: { isPublished: true } }),
    prisma.publishedContent.groupBy({
      by: ["contentType"],
      where: { isPublished: true },
      _count: true,
    }),
  ]);

  return (
    <AdminSection titleKey="admin.card.search">
      <div className="space-y-4">
        <p className="font-serif text-ink-soft">
          Public search reads directly from the{" "}
          <code className="px-1 rounded bg-slate-100">PublishedContent</code> table using Postgres
          case-insensitive contains queries on title and slug. No external index; the site stays
          consistent with the published store.
        </p>
        <div className="rounded border border-slate-200 bg-white p-4">
          <p className="text-sm">
            <span className="font-medium text-ink">{total}</span> indexed published items.
          </p>
          <ul className="mt-3 grid grid-cols-2 gap-1 text-sm md:grid-cols-3">
            {byType.map((row) => (
              <li key={row.contentType} className="flex justify-between">
                <span className="text-ink-soft">{row.contentType}</span>
                <span className="font-semibold text-ink">{row._count}</span>
              </li>
            ))}
          </ul>
        </div>
        <Link href="/search" className="text-sm text-indigo-600 underline">
          Try the public search →
        </Link>
      </div>
    </AdminSection>
  );
}
