import { getTranslator } from "@/lib/i18n/server";
import { PageHero } from "@/components/ui/PageHero";
import { listPublishedLiturgyEntries } from "@/lib/data/liturgy";
import { LITURGY_ITEMS } from "./_components/liturgyItems";

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

  return (
    <div>
      <PageHero
        eyebrow={t("nav.liturgyHistory")}
        title={t("liturgy.title")}
        subtitle={t("liturgy.subtitle")}
      />

      {entries.length > 0 ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {entries.map((e) => {
            const tr = e.translations[0];
            const title = tr?.title ?? e.title;
            const summary = tr?.summary ?? e.summary;
            return (
              <article key={e.id} className="vf-card rounded-sm p-8">
                <p className="vf-eyebrow">{KIND_LABELS[e.kind] ?? "Formation"}</p>
                <h2 className="mt-3 font-display text-2xl">{title}</h2>
                {summary ? (
                  <p className="mt-3 line-clamp-3 font-serif text-sm text-ink-soft">{summary}</p>
                ) : null}
              </article>
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
