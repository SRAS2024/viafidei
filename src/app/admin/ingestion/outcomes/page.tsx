import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { AdminSection } from "../../_sections/AdminSection";

export const dynamic = "force-dynamic";

/**
 * Recent ingestion outcomes — surfaces the per-row `outcomeReason`
 * the runner wrote so an admin can see WHY each piece of content
 * landed where it did (accepted, sent to review, archived, etc.).
 */
export default async function OutcomesPage() {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");

  const [prayers, saints, parishes, liturgy, guides] = await Promise.all([
    prisma.prayer.findMany({
      where: { outcomeReason: { not: null } },
      orderBy: { updatedAt: "desc" },
      take: 20,
      select: {
        slug: true,
        defaultTitle: true,
        status: true,
        outcomeReason: true,
        sourceTier: true,
        qualityScore: true,
        theologicalReviewFlag: true,
        updatedAt: true,
      },
    }),
    prisma.saint.findMany({
      where: { outcomeReason: { not: null } },
      orderBy: { updatedAt: "desc" },
      take: 20,
      select: {
        slug: true,
        canonicalName: true,
        status: true,
        outcomeReason: true,
        sourceTier: true,
        qualityScore: true,
        theologicalReviewFlag: true,
        updatedAt: true,
      },
    }),
    prisma.parish.findMany({
      where: { outcomeReason: { not: null } },
      orderBy: { updatedAt: "desc" },
      take: 20,
      select: {
        slug: true,
        name: true,
        status: true,
        outcomeReason: true,
        sourceTier: true,
        qualityScore: true,
        updatedAt: true,
      },
    }),
    prisma.liturgyEntry.findMany({
      where: { outcomeReason: { not: null } },
      orderBy: { updatedAt: "desc" },
      take: 20,
      select: {
        slug: true,
        title: true,
        status: true,
        outcomeReason: true,
        sourceTier: true,
        qualityScore: true,
        theologicalReviewFlag: true,
        updatedAt: true,
      },
    }),
    prisma.spiritualLifeGuide.findMany({
      where: { outcomeReason: { not: null } },
      orderBy: { updatedAt: "desc" },
      take: 20,
      select: {
        slug: true,
        title: true,
        status: true,
        outcomeReason: true,
        sourceTier: true,
        qualityScore: true,
        theologicalReviewFlag: true,
        updatedAt: true,
      },
    }),
  ]);

  type Row = {
    entity: string;
    slug: string;
    title: string;
    status: string;
    outcomeReason: string | null;
    sourceTier: number | null;
    qualityScore: number | null;
    theologicalReviewFlag?: boolean;
    updatedAt: Date;
  };
  const all: Row[] = [
    ...prayers.map((r) => ({
      entity: "Prayer",
      slug: r.slug,
      title: r.defaultTitle,
      status: r.status,
      outcomeReason: r.outcomeReason,
      sourceTier: r.sourceTier,
      qualityScore: r.qualityScore,
      theologicalReviewFlag: r.theologicalReviewFlag,
      updatedAt: r.updatedAt,
    })),
    ...saints.map((r) => ({
      entity: "Saint",
      slug: r.slug,
      title: r.canonicalName,
      status: r.status,
      outcomeReason: r.outcomeReason,
      sourceTier: r.sourceTier,
      qualityScore: r.qualityScore,
      theologicalReviewFlag: r.theologicalReviewFlag,
      updatedAt: r.updatedAt,
    })),
    ...parishes.map((r) => ({
      entity: "Parish",
      slug: r.slug,
      title: r.name,
      status: r.status,
      outcomeReason: r.outcomeReason,
      sourceTier: r.sourceTier,
      qualityScore: r.qualityScore,
      updatedAt: r.updatedAt,
    })),
    ...liturgy.map((r) => ({
      entity: "LiturgyEntry",
      slug: r.slug,
      title: r.title,
      status: r.status,
      outcomeReason: r.outcomeReason,
      sourceTier: r.sourceTier,
      qualityScore: r.qualityScore,
      theologicalReviewFlag: r.theologicalReviewFlag,
      updatedAt: r.updatedAt,
    })),
    ...guides.map((r) => ({
      entity: "SpiritualLifeGuide",
      slug: r.slug,
      title: r.title,
      status: r.status,
      outcomeReason: r.outcomeReason,
      sourceTier: r.sourceTier,
      qualityScore: r.qualityScore,
      theologicalReviewFlag: r.theologicalReviewFlag,
      updatedAt: r.updatedAt,
    })),
  ].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

  return (
    <AdminSection
      titleKey="admin.card.ingestion"
      subtitle="Recent ingestion outcomes — the reason each row was accepted, rejected, archived, or sent to review."
    >
      {all.length === 0 ? (
        <div className="vf-card rounded-sm p-8 text-center font-serif text-ink-faint">
          No items have a recorded outcome reason yet.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {all.slice(0, 50).map((r) => (
            <div key={`${r.entity}-${r.slug}`} className="vf-card rounded-sm p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="vf-eyebrow">
                    {r.entity}
                    {r.sourceTier ? ` · Tier ${r.sourceTier}` : ""}
                  </p>
                  <h3 className="font-display text-base">{r.title}</h3>
                  <p className="font-serif text-xs text-ink-faint">{r.slug}</p>
                </div>
                <span
                  className={`font-serif text-xs ${
                    r.status === "PUBLISHED"
                      ? "text-emerald-700"
                      : r.status === "REVIEW"
                        ? "text-amber-700"
                        : r.status === "ARCHIVED"
                          ? "text-ink-faint"
                          : "text-ink"
                  }`}
                >
                  {r.status}
                </span>
              </div>
              {r.outcomeReason ? (
                <p className="mt-2 font-serif text-xs text-ink-soft">{r.outcomeReason}</p>
              ) : null}
              <div className="mt-2 flex flex-wrap gap-3 font-serif text-xs text-ink-faint">
                {r.qualityScore != null ? (
                  <span>quality: {(r.qualityScore * 100).toFixed(0)}%</span>
                ) : null}
                {r.theologicalReviewFlag ? (
                  <span className="text-amber-700">theological review flagged</span>
                ) : null}
                <span>{r.updatedAt.toISOString().slice(0, 16)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminSection>
  );
}
