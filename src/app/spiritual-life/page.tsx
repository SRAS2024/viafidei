import { PageHero, PublishedList } from "@/components/ui";
import { getTranslator } from "@/lib/i18n/server";
import { listPublished } from "@/lib/data/published";

export const dynamic = "force-dynamic";
export const metadata = { title: "Spiritual Life" };

export default async function SpiritualLifePage() {
  const { t } = await getTranslator();
  const guides = await listPublished("GUIDE");
  const practices = await listPublished("SPIRITUAL_PRACTICE");
  return (
    <div>
      <PageHero
        eyebrow={t("nav.spiritualLife")}
        title={t("spiritualLife.title")}
        subtitle={t("spiritualLife.subtitle")}
      />
      <h2 className="mt-12 mb-6 font-display text-2xl text-ink">Guides</h2>
      <PublishedList items={guides} baseHref="/spiritual-life" eyebrowField="kind" />
      <h2 className="mt-12 mb-6 font-display text-2xl text-ink">Practices</h2>
      <PublishedList items={practices} baseHref="/spiritual-life" eyebrowField="practiceKind" />
    </div>
  );
}
