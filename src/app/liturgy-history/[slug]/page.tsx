import { notFound } from "next/navigation";
import Link from "next/link";
import { getTranslator } from "@/lib/i18n/server";
import { getPublishedLiturgyBySlug } from "@/lib/data/liturgy";
import { OfficialSourceLink } from "@/components/ui";
import { logPageError, logPageMissingContent } from "@/lib/observability/page-errors";
import { buildDetailMetadata, notFoundMetadataFor } from "@/lib/metadata";
import { checkLiturgyRender, checkHistoryRender, notifyRenderGateFailure } from "@/lib/content-qa";
import { logger } from "@/lib/observability/logger";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

const KIND_LABELS: Record<string, string> = {
  MASS_STRUCTURE: "Mass",
  LITURGICAL_YEAR: "Liturgical Year",
  SYMBOLISM: "Symbolism",
  MARRIAGE_RITE: "Marriage Rite",
  FUNERAL_RITE: "Funeral Rite",
  ORDINATION_RITE: "Ordination",
  COUNCIL_TIMELINE: "Councils",
  GLOSSARY: "Glossary",
  GENERAL: "Formation",
};

async function safeGetEntry(slug: string, locale: string) {
  try {
    return await getPublishedLiturgyBySlug(slug, locale as never);
  } catch (err) {
    logPageError({
      route: "/liturgy-history/[slug]",
      entityType: "LiturgyEntry",
      slug,
      error: err,
    });
    return null;
  }
}

export async function generateMetadata({ params }: Props) {
  const { locale } = await getTranslator();
  const { slug } = await params;
  const entry = await safeGetEntry(slug, locale);
  if (!entry) return notFoundMetadataFor("/liturgy-history");
  const tr = entry.translations[0];
  return buildDetailMetadata({
    path: `/liturgy-history/${slug}`,
    title: tr?.title ?? entry.title,
  });
}

export default async function LiturgyDetailPage({ params }: Props) {
  const { t, locale } = await getTranslator();
  const { slug } = await params;
  const entry = await safeGetEntry(slug, locale);
  if (!entry) {
    logPageMissingContent({
      route: "/liturgy-history/[slug]",
      entityType: "LiturgyEntry",
      slug,
      reason: "missing_record",
    });
    notFound();
  }

  // Strict render gate: history rows must satisfy the History contract;
  // pure liturgy rows must satisfy the Liturgy contract.
  const render = entry.historyType
    ? checkHistoryRender({
        historyType: entry.historyType,
        title: entry.title,
        dateOrEra: entry.dateOrEra,
        summary: entry.summary,
        body: entry.body,
        sourceUrl: entry.sourceUrl,
        externalSourceKey: entry.externalSourceKey,
      })
    : checkLiturgyRender({
        kind: entry.kind,
        title: entry.title,
        body: entry.body,
        sourceUrl: entry.sourceUrl,
        externalSourceKey: entry.externalSourceKey,
      });
  if (!render.ready) {
    logger.warn("liturgy_history.package_unready", { slug, missing: render.missing });
    logPageMissingContent({
      route: "/liturgy-history/[slug]",
      entityType: "LiturgyEntry",
      slug,
      reason: "validation_error",
    });
    void notifyRenderGateFailure({
      contentType: "LiturgyEntry",
      slug,
      missingFields: render.missing,
    });
    notFound();
  }

  const tr = entry.translations[0];
  const title = tr?.title ?? entry.title;
  const summary = tr?.summary ?? entry.summary;
  const body = tr?.body ?? entry.body;
  const kindLabel = KIND_LABELS[entry.kind] ?? "Formation";

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <Link href="/liturgy-history" className="vf-nav-link">
          ← {t("nav.liturgyHistory")}
        </Link>
      </div>

      <section className="mb-10 px-2 text-center">
        <p className="vf-eyebrow">{kindLabel}</p>
        <div className="vf-rule mx-auto my-5" />
        <h1 className="break-words font-display text-3xl leading-tight text-ink sm:text-5xl md:text-6xl">
          {title}
        </h1>
        {summary ? (
          <p className="mx-auto mt-5 max-w-reading font-serif text-base leading-relaxed text-ink-soft sm:text-lg">
            {summary}
          </p>
        ) : null}
      </section>

      <article className="vf-card rounded-sm p-6 prose prose-serif max-w-none sm:p-8">
        <div className="whitespace-pre-wrap break-words font-serif leading-relaxed text-ink-soft">
          {body}
        </div>
      </article>

      <OfficialSourceLink url={entry.externalSourceKey} />
    </div>
  );
}
