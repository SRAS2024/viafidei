import { getTranslator } from "@/lib/i18n/server";
import { PageHero } from "@/components/PageHero";

export const metadata = { title: "Spiritual Life" };

export default async function SpiritualLifePage() {
  const { t } = await getTranslator();
  const items = [
    { id: "rosary", key: "spiritualLife.rosary" },
    { id: "confession", key: "spiritualLife.confession" },
    { id: "adoration", key: "spiritualLife.adoration" },
    { id: "consecration", key: "spiritualLife.consecration" },
    { id: "vocations", key: "spiritualLife.vocations" },
  ];
  return (
    <div>
      <PageHero
        eyebrow={t("nav.spiritualLife")}
        title={t("spiritualLife.title")}
        subtitle={t("spiritualLife.subtitle")}
      />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((i) => (
          <article id={i.id} key={i.id} className="vf-card rounded-sm p-8">
            <p className="vf-eyebrow">Formation</p>
            <h2 className="mt-3 font-display text-3xl">{t(i.key)}</h2>
            <p className="mt-4 font-serif text-ink-soft">
              Step-by-step guide, readings, and devotional pacing.
            </p>
            <button className="vf-btn vf-btn-ghost mt-6">{t("spiritualLife.addGoal")}</button>
          </article>
        ))}
      </div>
    </div>
  );
}
