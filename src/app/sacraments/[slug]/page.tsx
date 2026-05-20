import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslator } from "@/lib/i18n/server";
import { getPublishedSpiritualLifeGuideBySlug } from "@/lib/data/spiritual-life";
import { tagsForSlug, withCacheTags } from "@/lib/cache/cached-data";
import { getBadgeForGoalSlug } from "@/components/icons/SacramentBadges";
import { PageHero } from "@/components/ui/PageHero";
import { OfficialSourceLink } from "@/components/ui";
import { buildDetailMetadata } from "@/lib/metadata";
import {
  checkSacramentRender,
  checkConsecrationRender,
  isCanonicalSacramentKey,
  notifyRenderGateFailure,
} from "@/lib/content-qa";
import { logPageMissingContent } from "@/lib/observability/page-errors";
import { logger } from "@/lib/observability/logger";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const title = slug.replace(/^(sacrament|consecration)-/, "").replace(/-/g, " ");
  return buildDetailMetadata({ path: `/sacraments/${slug}`, title });
}

export default async function SacramentDetailPage({ params }: Props) {
  const { t, locale } = await getTranslator();
  const { slug } = await params;
  if (!slug.startsWith("sacrament-") && !slug.startsWith("consecration-")) {
    notFound();
  }
  // Spec §19: per-slug cache scoped by content-slug + content-type tags.
  const contentType = slug.startsWith("consecration-") ? "Consecration" : "Sacrament";
  const tab = slug.startsWith("consecration-") ? "consecrations" : "sacraments";
  const cfg = tagsForSlug({ contentType, tab, slug });
  const cached = await withCacheTags<
    Parameters<typeof getPublishedSpiritualLifeGuideBySlug>,
    Awaited<ReturnType<typeof getPublishedSpiritualLifeGuideBySlug>>
  >({
    keyParts: [tab, "detail", slug, locale],
    tags: cfg.tags,
    revalidateSeconds: cfg.revalidateSeconds,
    fn: getPublishedSpiritualLifeGuideBySlug,
  });
  const guide = await cached(slug, locale);
  if (!guide) notFound();

  // Strict render gate. Sacraments must have one of the seven canonical
  // keys; consecrations need duration + daily prayers + final prayer.
  const isConsecrationSlug = slug.startsWith("consecration-");
  if (isConsecrationSlug) {
    const render = checkConsecrationRender({
      title: guide.title,
      background: guide.background ?? guide.summary,
      durationDays: guide.durationDays,
      packageMetadata: guide.packageMetadata as {
        dailyPrayers?: unknown[];
        finalConsecrationPrayer?: string;
      } | null,
    });
    if (!render.ready) {
      logger.warn("consecration.package_unready", { slug, missing: render.missing });
      logPageMissingContent({
        route: "/sacraments/[slug]",
        entityType: "SpiritualLifeGuide",
        slug,
        reason: "validation_error",
      });
      void notifyRenderGateFailure({
        contentType: "Consecration",
        slug,
        missingFields: render.missing,
      });
      notFound();
    }
  } else if (!isCanonicalSacramentKey(guide.sacramentKey)) {
    logger.warn("sacrament.invalid_key", { slug, sacramentKey: guide.sacramentKey });
    logPageMissingContent({
      route: "/sacraments/[slug]",
      entityType: "Sacrament",
      slug,
      reason: "validation_error",
    });
    void notifyRenderGateFailure({
      contentType: "Sacrament",
      slug,
      missingFields: ["sacramentKey"],
    });
    notFound();
  } else {
    const render = checkSacramentRender({
      sacramentKey: guide.sacramentKey,
      sacramentGroup: guide.sacramentGroup,
      title: guide.title,
      background: guide.background ?? guide.summary,
      bodyText: guide.bodyText,
      summary: guide.summary,
    });
    if (!render.ready) {
      logger.warn("sacrament.package_unready", { slug, missing: render.missing });
      logPageMissingContent({
        route: "/sacraments/[slug]",
        entityType: "Sacrament",
        slug,
        reason: "validation_error",
      });
      void notifyRenderGateFailure({
        contentType: "Sacrament",
        slug,
        missingFields: render.missing,
      });
      notFound();
    }
  }

  const title = guide.translations[0]?.title ?? guide.title;
  const summary = guide.translations[0]?.summary ?? guide.summary;
  const bodyText = guide.translations[0]?.bodyText ?? guide.bodyText;
  const Badge = getBadgeForGoalSlug(guide.goalTemplateSlug ?? null);
  const isConsecration = slug.startsWith("consecration-");

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
              profile. The goal will guide you through the preparation, daily readings, and the act
              of {isConsecration ? "consecration" : "reception"} — and stay in your spiritual
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
