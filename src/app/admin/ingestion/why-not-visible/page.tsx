import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { listNonPublicRows, type WhyNotVisibleFilter } from "@/lib/data/why-not-visible";
import { AdminSection } from "../../_sections/AdminSection";

export const dynamic = "force-dynamic";

const FILTERS: ReadonlyArray<{ key: WhyNotVisibleFilter; label: string }> = [
  { key: "all", label: "All non-public rows" },
  { key: "missing_source", label: "Missing source" },
  { key: "missing_required_fields", label: "Missing required fields" },
  { key: "source_not_approved", label: "Source not approved" },
  { key: "build_failed", label: "Build failed" },
  { key: "qa_failed", label: "QA failed" },
  { key: "deleted", label: "Deleted / archived" },
  { key: "duplicate", label: "Duplicate" },
  { key: "waiting_for_worker", label: "Waiting for worker" },
  { key: "waiting_for_cleanup", label: "Waiting for cleanup" },
];

export default async function WhyNotVisible({
  searchParams,
}: {
  searchParams?: Promise<{ filter?: string }>;
}) {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");
  const params = (await searchParams) ?? {};
  const filter = (FILTERS.map((f) => f.key) as string[]).includes(params.filter ?? "")
    ? (params.filter as WhyNotVisibleFilter)
    : "all";

  const rows = await listNonPublicRows({ filter, limit: 250 });

  return (
    <AdminSection titleKey="admin.card.ingestion">
      <div className="mb-6">
        <h2 className="font-display text-2xl">Why is this content not visible?</h2>
        <p className="mt-2 font-serif text-sm text-stone-700">
          One row per non-public catalog entry. Each row joins the latest build attempt + last
          strict-QA reason + source purpose so the system can explain — and the admin can verify —
          why nothing was published.
        </p>
      </div>

      <nav className="mb-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <a
            key={f.key}
            href={`?filter=${f.key}`}
            className={`rounded-sm px-3 py-1 font-serif text-sm ${
              f.key === filter
                ? "bg-stone-900 text-white"
                : "border border-stone-300 text-stone-700 hover:bg-stone-100"
            }`}
          >
            {f.label}
          </a>
        ))}
      </nav>

      <p className="mb-4 font-serif text-xs text-stone-600">
        Showing {rows.length} row{rows.length === 1 ? "" : "s"} (limit 250).
      </p>

      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse font-serif text-xs">
          <thead className="bg-stone-100">
            <tr>
              <th className="border border-stone-200 px-2 py-1 text-left">Type</th>
              <th className="border border-stone-200 px-2 py-1 text-left">Title</th>
              <th className="border border-stone-200 px-2 py-1 text-left">Status</th>
              <th className="border border-stone-200 px-2 py-1 text-left">Render</th>
              <th className="border border-stone-200 px-2 py-1 text-left">Threshold</th>
              <th className="border border-stone-200 px-2 py-1 text-left">Validation</th>
              <th className="border border-stone-200 px-2 py-1 text-left">Failed contract</th>
              <th className="border border-stone-200 px-2 py-1 text-left">Missing fields</th>
              <th className="border border-stone-200 px-2 py-1 text-left">Last build</th>
              <th className="border border-stone-200 px-2 py-1 text-left">Last QA</th>
              <th className="border border-stone-200 px-2 py-1 text-left">Source host</th>
              <th className="border border-stone-200 px-2 py-1 text-left">Suggested next action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.contentType}:${r.contentId}`}>
                <td className="border border-stone-200 px-2 py-1">{r.contentType}</td>
                <td className="border border-stone-200 px-2 py-1">{r.title}</td>
                <td className="border border-stone-200 px-2 py-1">{r.status}</td>
                <td className="border border-stone-200 px-2 py-1">
                  {r.publicRenderReady ? "yes" : "no"}
                </td>
                <td className="border border-stone-200 px-2 py-1">
                  {r.isThresholdEligible ? "yes" : "no"}
                </td>
                <td className="border border-stone-200 px-2 py-1">
                  {r.packageValidationStatus ?? "—"}
                </td>
                <td className="border border-stone-200 px-2 py-1">{r.failedContract ?? "—"}</td>
                <td className="border border-stone-200 px-2 py-1">
                  {r.missingFields.length > 0 ? r.missingFields.slice(0, 4).join(", ") : "—"}
                </td>
                <td className="border border-stone-200 px-2 py-1">
                  {r.lastBuildAttempt ? r.lastBuildAttempt.toISOString().slice(0, 16) : "—"}
                  {r.lastBuildOutcome ? ` (${r.lastBuildOutcome})` : ""}
                </td>
                <td className="border border-stone-200 px-2 py-1">
                  {r.lastQaRun ? r.lastQaRun.toISOString().slice(0, 16) : "—"}
                </td>
                <td className="border border-stone-200 px-2 py-1">{r.sourceHost ?? "—"}</td>
                <td className="border border-stone-200 px-2 py-1 italic">
                  {r.suggestedNextAction}
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={12}
                  className="border border-stone-200 px-2 py-3 text-center italic text-stone-600"
                >
                  No rows match this filter.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </AdminSection>
  );
}
