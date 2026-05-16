import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { AdminSection } from "../../_sections/AdminSection";

export const dynamic = "force-dynamic";

/**
 * Content change feed. Lists the most recent ContentVersion rows so
 * the admin can see what changed during ingestion updates (previous
 * title, previous body excerpt, previous checksum, etc.). Rows on
 * theology / saints / Church docs default to `reviewRequired = true`
 * so the admin can triage doctrinal changes.
 */
export default async function ContentChangesPage() {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");

  const versions = await prisma.contentVersion.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <AdminSection
      titleKey="admin.card.ingestion"
      subtitle="Content change history — every ingestion update that altered an existing row writes a snapshot here."
    >
      {versions.length === 0 ? (
        <div className="vf-card rounded-sm p-8 text-center font-serif text-ink-faint">
          No content changes have been recorded yet.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {versions.map((v) => (
            <div key={v.id} className="vf-card rounded-sm p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="vf-eyebrow">{v.entityType}</p>
                  <h3 className="mt-1 font-display text-lg">
                    {v.previousTitle ?? <em className="text-ink-faint">(no previous title)</em>}
                  </h3>
                  <p className="font-serif text-xs text-ink-faint">id: {v.entityId}</p>
                </div>
                <div className="text-right">
                  <p className="font-serif text-xs text-ink-faint">
                    {v.createdAt.toISOString().slice(0, 16)}
                  </p>
                  {v.reviewRequired ? (
                    <span className="mt-1 inline-block rounded-sm bg-amber-100 px-2 py-0.5 font-serif text-xs text-amber-900">
                      Review required
                    </span>
                  ) : null}
                </div>
              </div>
              {v.changeSummary ? (
                <p className="mt-2 font-serif text-sm text-ink-soft">{v.changeSummary}</p>
              ) : null}
              {v.previousBody ? (
                <details className="mt-3">
                  <summary className="cursor-pointer font-serif text-xs text-ink-soft">
                    Previous body (excerpt)
                  </summary>
                  <pre className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-sm bg-ink/5 p-3 font-serif text-xs">
                    {v.previousBody.slice(0, 600)}
                    {v.previousBody.length > 600 ? "…" : ""}
                  </pre>
                </details>
              ) : null}
              <div className="mt-3 grid grid-cols-1 gap-1 font-serif text-xs text-ink-faint sm:grid-cols-3">
                <span>checksum: {v.previousChecksum?.slice(0, 12) ?? "—"}</span>
                <span>status: {v.previousStatus ?? "—"}</span>
                <span>source: {v.previousSource ?? "—"}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminSection>
  );
}
