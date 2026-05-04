import Link from "next/link";
import { getTranslator } from "@/lib/i18n/server";
import { PageHero } from "@/components/ui/PageHero";
import { listPublishedLiturgyEntries } from "@/lib/data/liturgy";
import { matchesRite, RITE_LABEL_KEYS } from "@/lib/content/rites";
import { getRiteCookieValue } from "@/lib/i18n/rite-cookie";
import { LITURGY_ITEMS } from "./_components/liturgyItems";

export const dynamic = "force-dynamic";
export const metadata = { title: "Liturgy & History" };

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

export default async function LiturgyPage() {
  const { t, locale } = await getTranslator();
  const entries = await listPublishedLiturgyEntries(locale);
  const rite = await getRiteCookieValue();
  const visibleEntries = entries.filter((e) => matchesRite(e.slug, rite));

  return (
    <div>
      <PageHero
        eyebrow={t("nav.liturgyHistory")}
        title={t("liturgy.title")}
        subtitle={t("liturgy.subtitle")}
      />

      <p className="mb-6 font-serif text-sm text-ink-faint">
        {t("rite.label")}: <span className="text-ink">{t(RITE_LABEL_KEYS[rite])}</span>
      </p>

      <Link
        href="/liturgy-history/timeline"
        className="mb-8 block vf-card rounded-sm p-6 transition hover:border-ink/30 hover:-translate-y-0.5"
      >
        <p className="vf-eyebrow">Timeline</p>
        <h2 className="mt-2 font-display text-2xl">Complete Church History Timeline →</h2>
        <p className="mt-2 font-serif text-sm text-ink-soft">
          From Christ&rsquo;s ministry through 2025 &mdash; every major period, every ecumenical
          council, with full historical context. Tap to explore.
        </p>
      </Link>

      {visibleEntries.length > 0 ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {visibleEntries.map((e) => {
            const tr = e.translations[0];
            const title = tr?.title ?? e.title;
            const summary = tr?.summary ?? e.summary;
            return (
              <Link key={e.id} href={`/liturgy-history/${e.slug}`}>
                <article className="vf-card h-full rounded-sm p-8 transition hover:border-ink/30 hover:-translate-y-0.5">
                  <p className="vf-eyebrow">{KIND_LABELS[e.kind] ?? "Formation"}</p>
                  <h2 className="mt-3 font-display text-2xl">{title}</h2>
                  {summary ? (
                    <p className="mt-3 line-clamp-3 font-serif text-sm text-ink-soft">{summary}</p>
                  ) : null}
                </article>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {LITURGY_ITEMS.map((i) => (
            <article key={i.key} className="vf-card rounded-sm p-8">
              <p className="vf-eyebrow">Formation</p>
              <h2 className="mt-3 font-display text-2xl">{t(i.key)}</h2>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
