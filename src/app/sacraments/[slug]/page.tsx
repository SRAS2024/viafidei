import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslator } from "@/lib/i18n/server";
import { getPublishedSpiritualLifeGuideBySlug } from "@/lib/data/spiritual-life";
import { getBadgeForGoalSlug } from "@/components/icons/SacramentBadges";
import { PageHero } from "@/components/ui/PageHero";
import { OfficialSourceLink } from "@/components/ui";

export const dynamic = "force-dynamic";

type Props = { params: { slug: string } };

export async function generateMetadata({ params }: Props) {
  return { title: params.slug.replace(/^(sacrament|consecration)-/, "").replace(/-/g, " ") };
}

export default async function SacramentDetailPage({ params }: Props) {
  const { t, locale } = await getTranslator();
  if (
    !params.slug.startsWith("sacrament-") &&
    !params.slug.startsWith("consecration-")
  ) {
    notFound();
  }
  const guide = await getPublishedSpiritualLifeGuideBySlug(params.slug, locale);
  if (!guide) notFound();

  const title = guide.translations[0]?.title ?? guide.title;
  const summary = guide.translations[0]?.summary ?? guide.summary;
  const bodyText = guide.translations[0]?.bodyText ?? guide.bodyText;
  const Badge = getBadgeForGoalSlug(guide.goalTemplateSlug ?? null);
  const isConsecration = params.slug.startsWith("consecration-");

  return (
    <div>
      <div className="mb-4">
        <Link href="/sacraments" className="vf-nav-link">
          ← {t("common.back")}
        </Link>
      </div>
      <PageHero
        eyebrow={isConsecration ? "Personal consecration" : "Sacrament"}
        title={title}
        subtitle={summary}
      />
      <div className="mx-auto flex max-w-reading flex-col gap-6">
        {Badge ? (
          <div className="flex justify-center text-ink">
            <Badge size={84} />
          </div>
        ) : null}
        {bodyText ? (
          <article className="vf-card rounded-sm p-8">
            <div className="vf-prose font-serif leading-relaxed text-ink-soft whitespace-pre-line">
              {bodyText}
            </div>
          </article>
        ) : null}
        {guide.goalTemplateSlug ? (
          <div className="vf-card rounded-sm p-6 text-center">
            <p className="font-serif text-sm text-ink-soft">
              You can add this {isConsecration ? "consecration" : "sacrament"} as a goal on your
              profile. The goal will guide you through the preparation, daily readings, and the
              act of {isConsecration ? "consecration" : "reception"} — and stay in your spiritual
              history once it is complete.
            </p>
            <Link
              href={`/profile/goals/new?templateSlug=${encodeURIComponent(guide.goalTemplateSlug)}`}
              className="vf-btn vf-btn-primary mt-4 inline-block"
            >
              Add as goal
            </Link>
          </div>
        ) : null}
        <OfficialSourceLink url={guide.externalSourceKey} />
      </div>
    </div>
  );
}
