import { notFound } from "next/navigation";
import Link from "next/link";
import { getTranslator } from "@/lib/i18n/server";
import { getPublishedLiturgyBySlug } from "@/lib/data/liturgy";
import { logger } from "@/lib/observability/logger";

export const dynamic = "force-dynamic";

type Props = { params: { slug: string } };

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
    logger.error("liturgy.lookup_failed", { slug, error: (err as Error).message });
    return null;
  }
}

export async function generateMetadata({ params }: Props) {
  const { locale } = await getTranslator();
  const entry = await safeGetEntry(params.slug, locale);
  if (!entry) return { title: "Not Found" };
  const tr = entry.translations[0];
  return { title: tr?.title ?? entry.title };
}

export default async function LiturgyDetailPage({ params }: Props) {
  const { t, locale } = await getTranslator();
  const entry = await safeGetEntry(params.slug, locale);
  if (!entry) notFound();

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

      <section className="mb-10 text-center">
        <p className="vf-eyebrow">{kindLabel}</p>
        <div className="vf-rule mx-auto my-5" />
        <h1 className="font-display text-5xl leading-tight text-ink sm:text-6xl">{title}</h1>
        {summary ? (
          <p className="mx-auto mt-5 max-w-reading font-serif text-lg leading-relaxed text-ink-soft">
            {summary}
          </p>
        ) : null}
      </section>

      <article className="vf-card rounded-sm p-8 prose prose-serif max-w-none">
        <div className="whitespace-pre-wrap font-serif leading-relaxed text-ink-soft">{body}</div>
      </article>
    </div>
  );
}
