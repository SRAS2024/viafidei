import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { AdminSection } from "../../_sections/AdminSection";
import { ContentDiff } from "./ContentDiff";

export const dynamic = "force-dynamic";

/**
 * Resolve the current title + body for an entity so the diff viewer
 * can show before/after. We only fetch the cheap text fields.
 */
async function getCurrentEntity(
  entityType: string,
  entityId: string,
): Promise<{ title: string | null; body: string | null }> {
  try {
    switch (entityType) {
      case "Prayer": {
        const r = await prisma.prayer.findUnique({
          where: { id: entityId },
          select: { defaultTitle: true, body: true },
        });
        return { title: r?.defaultTitle ?? null, body: r?.body ?? null };
      }
      case "Saint": {
        const r = await prisma.saint.findUnique({
          where: { id: entityId },
          select: { canonicalName: true, biography: true },
        });
        return { title: r?.canonicalName ?? null, body: r?.biography ?? null };
      }
      case "LiturgyEntry": {
        const r = await prisma.liturgyEntry.findUnique({
          where: { id: entityId },
          select: { title: true, body: true },
        });
        return { title: r?.title ?? null, body: r?.body ?? null };
      }
      case "SpiritualLifeGuide": {
        const r = await prisma.spiritualLifeGuide.findUnique({
          where: { id: entityId },
          select: { title: true, summary: true },
        });
        return { title: r?.title ?? null, body: r?.summary ?? null };
      }
      default:
        return { title: null, body: null };
    }
  } catch {
    return { title: null, body: null };
  }
}

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
  // Resolve current title/body for each entity so the diff viewer can
  // show before/after. Bounded by the take=50 above so the cost is
  // proportionate.
  const currents = await Promise.all(
    versions.map((v) => getCurrentEntity(v.entityType, v.entityId)),
  );
  const currentByVersion = new Map(versions.map((v, i) => [v.id, currents[i]]));

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
              <ContentDiff
                previousTitle={v.previousTitle}
                previousBody={v.previousBody}
                currentTitle={currentByVersion.get(v.id)?.title ?? null}
                currentBody={currentByVersion.get(v.id)?.body ?? null}
                contentVersionId={v.id}
              />
              {v.reviewRequired ? (
                <div className="mt-3 flex flex-wrap gap-2 font-serif text-xs text-ink-soft">
                  Action:
                </div>
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
