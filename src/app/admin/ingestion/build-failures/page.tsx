import { redirect } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { listRecentBuildFailures } from "@/lib/content-factory";
import { AdminSection } from "../../_sections/AdminSection";

export const dynamic = "force-dynamic";

const FILTER_TYPES: ReadonlyArray<string> = [
  "all",
  "Prayer",
  "Saint",
  "MarianApparition",
  "Devotion",
  "Novena",
  "Sacrament",
  "Rosary",
  "Consecration",
  "SpiritualGuidance",
  "Liturgy",
  "History",
  "Parish",
];

/**
 * Build Failures admin page — the companion to /admin/content-qa/deleted-log.
 *
 *   - Build Failures (this page) — every package the factory could
 *     not build. Answers "why was this content not created?".
 *   - Deleted Invalid Content Log — every package the factory built
 *     but strict QA rejected or deleted. Answers "why was this content
 *     removed?".
 *
 * Together the two pages cover both halves of the spec line "Admin
 * dashboards should show both [build logs and rejected logs]."
 */
export default async function BuildFailuresPage({
  searchParams,
}: {
  searchParams?: Promise<{ contentType?: string }>;
}) {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");
  const params = (await searchParams) ?? {};
  const filter = FILTER_TYPES.includes(params.contentType ?? "")
    ? (params.contentType as string)
    : "all";

  const rows = await listRecentBuildFailures({
    contentType: filter === "all" ? undefined : (filter as never),
    limit: 250,
  }).catch(() => []);

  return (
    <AdminSection titleKey="admin.card.ingestion">
      <div className="mb-6">
        <h2 className="font-display text-2xl">Build failures</h2>
        <p className="mt-2 font-serif text-sm text-stone-700">
          Every package the content factory attempted to build but could not produce in
          built_complete_package form. Pair this with{" "}
          <Link href="/admin/content-qa/deleted-log" className="vf-nav-link">
            Deleted Invalid Content Log
          </Link>{" "}
          to see the full life-cycle of rejected content.
        </p>
      </div>

      <nav className="mb-6 flex flex-wrap gap-2 font-serif text-sm">
        {FILTER_TYPES.map((t) => (
          <a
            key={t}
            href={t === "all" ? "?" : `?contentType=${t}`}
            className={`rounded-sm px-3 py-1 ${
              t === filter
                ? "bg-stone-900 text-white"
                : "border border-stone-300 text-stone-700 hover:bg-stone-100"
            }`}
          >
            {t === "all" ? "All types" : t}
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
              <th className="border border-stone-200 px-2 py-1 text-left">Build status</th>
              <th className="border border-stone-200 px-2 py-1 text-left">Source URL</th>
              <th className="border border-stone-200 px-2 py-1 text-left">Source host</th>
              <th className="border border-stone-200 px-2 py-1 text-left">Missing fields</th>
              <th className="border border-stone-200 px-2 py-1 text-left">Failure reason</th>
              <th className="border border-stone-200 px-2 py-1 text-left">Created</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="border border-stone-200 px-2 py-3 text-center italic text-stone-600"
                >
                  No build failures match this filter.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td className="border border-stone-200 px-2 py-1">{r.contentType}</td>
                  <td className="border border-stone-200 px-2 py-1">{r.buildStatus}</td>
                  <td
                    className="border border-stone-200 px-2 py-1 max-w-xs truncate"
                    title={r.sourceUrl}
                  >
                    {r.sourceUrl}
                  </td>
                  <td className="border border-stone-200 px-2 py-1">{r.sourceHost}</td>
                  <td className="border border-stone-200 px-2 py-1">
                    {r.missingFields.length > 0 ? r.missingFields.slice(0, 4).join(", ") : "—"}
                  </td>
                  <td className="border border-stone-200 px-2 py-1">{r.failureReason ?? "—"}</td>
                  <td className="border border-stone-200 px-2 py-1">
                    {r.createdAt.toISOString().slice(0, 16)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </AdminSection>
  );
}
