import Link from "next/link";
import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/auth/admin";
import { prisma } from "@/lib/db/client";
import { scanForJanitorFindings, filterByAction } from "@/lib/checklist";
import { JanitorActions } from "../JanitorActions";

export const dynamic = "force-dynamic";

export default async function JanitorDeletesPage() {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");

  const findings = filterByAction(await scanForJanitorFindings(prisma), "delete");

  return (
    <div className="space-y-6">
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="font-display text-3xl text-ink">Janitor: deletes</h1>
          <p className="mt-1 font-serif text-ink-soft">
            {findings.length} published item(s) the worker recommends removing from the site.
          </p>
        </div>
        <div className="space-x-4 text-sm">
          <Link className="text-indigo-600 underline" href="/admin/checklist/janitor/edits">
            view edits →
          </Link>
          <Link className="text-indigo-600 underline" href="/admin/checklist">
            ← dashboard
          </Link>
        </div>
      </header>

      <table className="w-full table-auto border-collapse text-sm">
        <thead>
          <tr className="bg-slate-50 text-left">
            <th className="border-b px-3 py-2">Item</th>
            <th className="border-b px-3 py-2">Type</th>
            <th className="border-b px-3 py-2">Severity</th>
            <th className="border-b px-3 py-2">Reason</th>
            <th className="border-b px-3 py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {findings.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-3 py-6 text-center text-ink-faint">
                Nothing to delete — the janitor is happy.
              </td>
            </tr>
          ) : (
            findings.map((f) => (
              <tr key={f.checklistItemId} className="border-b">
                <td className="px-3 py-2">
                  <Link
                    href={`/admin/checklist/item/${f.checklistItemId}`}
                    className="underline text-ink"
                  >
                    {f.title}
                  </Link>
                  <div className="text-xs text-ink-soft">{f.slug}</div>
                </td>
                <td className="px-3 py-2 text-ink-soft">{f.contentType}</td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded px-2 py-0.5 text-xs ${
                      f.severity === "high"
                        ? "bg-rose-100 text-rose-800"
                        : f.severity === "medium"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {f.severity}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs text-ink-soft max-w-md">
                  <div className="font-medium text-ink">{f.reason}</div>
                  {f.details.length > 0 && (
                    <div className="mt-0.5">{f.details.slice(0, 2).join("; ")}</div>
                  )}
                </td>
                <td className="px-3 py-2">
                  <JanitorActions itemId={f.checklistItemId} action="delete" />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
