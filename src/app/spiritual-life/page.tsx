import { getTranslator } from "@/lib/i18n/server";
import { PageHero } from "@/components/ui/PageHero";
import { FORMATION_ITEMS, FormationCard } from "./_components";

export const metadata = { title: "Spiritual Life" };

export default async function SpiritualLifePage() {
  const { t } = await getTranslator();

  return (
    <div>
      <PageHero
        eyebrow={t("nav.spiritualLife")}
        title={t("spiritualLife.title")}
        subtitle={t("spiritualLife.subtitle")}
      />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {FORMATION_ITEMS.map((item) => (
          <FormationCard key={item.id} item={item} t={t} />
        ))}
      </div>
    </div>
  );
}
