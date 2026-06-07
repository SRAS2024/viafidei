import { redirect } from "next/navigation";
import Link from "next/link";

import { requireAdmin } from "@/lib/auth/admin";
import { prisma } from "@/lib/db/client";
import { AUTHORITY_SOURCES } from "@/lib/checklist";

export const dynamic = "force-dynamic";

export default async function AuthoritySources() {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");

  const stored = await prisma.authoritySource.findMany({
    orderBy: [{ authorityLevel: "asc" }, { name: "asc" }],
  });

  return (
    <div className="space-y-6">
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="font-display text-3xl text-ink">Authority source registry</h1>
          <p className="mt-1 font-serif text-ink-soft">
            {stored.length} approved Catholic sources. The worker physically refuses to fetch any
            URL whose host is not in this registry.
          </p>
        </div>
        <Link className="text-sm text-indigo-600 underline" href="/admin/checklist">
          ← dashboard
        </Link>
      </header>

      <p className="text-xs text-ink-soft">
        Bootstrapped list ({AUTHORITY_SOURCES.length} entries) lives in{" "}
        <code className="px-1 py-0.5 bg-slate-100 rounded">
          src/lib/checklist/sources/authority-registry.ts
        </code>
        . Run <code className="px-1 py-0.5 bg-slate-100 rounded">npm run seed:checklist</code> to
        sync.
      </p>

      <table className="w-full table-auto border-collapse text-sm">
        <thead>
          <tr className="bg-slate-50 text-left">
            <th className="border-b px-3 py-2">Source</th>
            <th className="border-b px-3 py-2">Host</th>
            <th className="border-b px-3 py-2">Authority</th>
            <th className="border-b px-3 py-2">Active</th>
            <th className="border-b px-3 py-2">Content types</th>
          </tr>
        </thead>
        <tbody>
          {stored.map((src) => (
            <tr key={src.id} className="border-b">
              <td className="px-3 py-2">
                <div className="font-medium text-ink">{src.name}</div>
                {src.description && <div className="text-xs text-ink-soft">{src.description}</div>}
              </td>
              <td className="px-3 py-2 text-ink-soft">{src.host}</td>
              <td className="px-3 py-2">
                <span className="rounded bg-indigo-100 px-2 py-0.5 text-xs text-indigo-800">
                  {src.authorityLevel}
                </span>
              </td>
              <td className="px-3 py-2 text-ink-soft">{src.isActive ? "✓" : "—"}</td>
              <td className="px-3 py-2 text-xs text-ink-soft">{src.contentTypes.join(", ")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
