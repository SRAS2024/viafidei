import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import {
  DATA_MANAGEMENT_ACTIONS,
  dataManagementActionLabel,
  listDataManagementLogs,
} from "@/lib/data/data-management-log";
import { AdminSection } from "../../_sections/AdminSection";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: {
    action?: string;
    contentType?: string;
    triggeredBy?: string;
  };
};

const CONTENT_TYPES = [
  "Prayer",
  "Saint",
  "MarianApparition",
  "Devotion",
  "LiturgyEntry",
  "SpiritualLifeGuide",
  "Parish",
];

export default async function DataManagementLogPage({ searchParams }: Props) {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");
  const action = (DATA_MANAGEMENT_ACTIONS as ReadonlyArray<string>).includes(
    searchParams.action ?? "",
  )
    ? (searchParams.action as (typeof DATA_MANAGEMENT_ACTIONS)[number])
    : undefined;
  const contentType = CONTENT_TYPES.includes(searchParams.contentType ?? "")
    ? searchParams.contentType
    : undefined;
  const triggeredBy =
    searchParams.triggeredBy === "automatic" || searchParams.triggeredBy === "manual"
      ? searchParams.triggeredBy
      : undefined;
  const { items } = await listDataManagementLogs({
    action,
    contentType,
    triggeredBy,
    take: 100,
  });

  function buildHref(params: Record<string, string | undefined>): string {
    const out = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v) out.set(k, v);
    }
    const qs = out.toString();
    return qs ? `?${qs}` : "";
  }

  return (
    <AdminSection
      titleKey="admin.card.logs"
      subtitle="Data Management — every addition, update, deletion, rejection, archive, dedupe, and category correction performed by the Ingestion & Data Management system."
    >
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <Link href="/admin/logs" className="vf-nav-link">
          ← Logs
        </Link>
        <Link href="/admin/diagnostics/ingestion" className="vf-nav-link">
          Ingestion diagnostics →
        </Link>
        <Link href="/admin/ingestion" className="vf-nav-link">
          Open Ingestion page →
        </Link>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <Link
          href="/admin/logs/data-management"
          className={`vf-btn !py-1 !px-3 text-xs ${
            !action && !contentType && !triggeredBy ? "vf-btn-primary" : "vf-btn-ghost"
          }`}
        >
          All
        </Link>
        {DATA_MANAGEMENT_ACTIONS.map((a) => (
          <Link
            key={a}
            href={`/admin/logs/data-management${buildHref({ action: a, contentType, triggeredBy })}`}
            className={`vf-btn !py-1 !px-3 text-xs ${
              action === a ? "vf-btn-primary" : "vf-btn-ghost"
            }`}
          >
            {dataManagementActionLabel(a)}
          </Link>
        ))}
        <span className="vf-eyebrow mt-1 ml-2 text-ink-faint">|</span>
        {(["automatic", "manual"] as const).map((mode) => (
          <Link
            key={mode}
            href={`/admin/logs/data-management${buildHref({ action, contentType, triggeredBy: mode })}`}
            className={`vf-btn !py-1 !px-3 text-xs ${
              triggeredBy === mode ? "vf-btn-primary" : "vf-btn-ghost"
            }`}
          >
            {mode === "automatic" ? "Automatic" : "Manual"}
          </Link>
        ))}
      </div>

      <div className="vf-card overflow-x-auto rounded-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-ink/10 text-xs uppercase tracking-[0.2em] text-ink-faint">
              <th className="px-4 py-4 sm:px-5">When</th>
              <th className="px-4 py-4 sm:px-5">Action</th>
              <th className="px-4 py-4 sm:px-5">Content type</th>
              <th className="px-4 py-4 sm:px-5">Item</th>
              <th className="hidden px-4 py-4 sm:table-cell sm:px-5">Reason</th>
              <th className="px-4 py-4 sm:px-5">By</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center font-serif text-ink-faint">
                  No data-management activity matches this filter yet.
                </td>
              </tr>
            ) : (
              items.map((r) => (
                <tr key={r.id} className="border-b border-ink/5 font-serif">
                  <td className="px-4 py-3 text-ink-faint sm:px-5">
                    {r.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                  </td>
                  <td className="px-4 py-3 sm:px-5">{dataManagementActionLabel(r.action)}</td>
                  <td className="break-words px-4 py-3 text-ink-soft sm:px-5">{r.contentType}</td>
                  <td className="break-all px-4 py-3 sm:px-5">{r.contentRef ?? "—"}</td>
                  <td className="hidden break-words px-4 py-3 text-ink-faint sm:table-cell sm:px-5">
                    {r.reason ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-ink-faint sm:px-5">
                    {r.triggeredBy}
                    {r.actorUsername ? ` · ${r.actorUsername}` : ""}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {items.length > 0 ? (
        <p className="mt-4 text-center font-serif text-xs text-ink-faint">
          Showing the most recent {items.length} entr{items.length === 1 ? "y" : "ies"}.
        </p>
      ) : null}
    </AdminSection>
  );
}
