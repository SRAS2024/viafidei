import { getTranslator } from "@/lib/i18n/server";
import { PageHero } from "@/components/PageHero";

export const metadata = { title: "Liturgy & History" };

export default async function LiturgyPage() {
  const { t } = await getTranslator();
  const items = [
    { key: "liturgy.massOrder" },
    { key: "liturgy.year" },
    { key: "liturgy.rites" },
    { key: "liturgy.councils" },
    { key: "liturgy.symbols" },
  ];
  return (
    <div>
      <PageHero
        eyebrow={t("nav.liturgyHistory")}
        title={t("liturgy.title")}
        subtitle={t("liturgy.subtitle")}
      />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((i) => (
          <article key={i.key} className="vf-card rounded-sm p-8">
            <p className="vf-eyebrow">Formation</p>
            <h2 className="mt-3 font-display text-2xl">{t(i.key)}</h2>
          </article>
        ))}
      </div>
    </div>
  );
}
