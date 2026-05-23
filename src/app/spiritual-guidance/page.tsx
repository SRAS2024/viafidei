import { PageHero, PublishedList } from "@/components/ui";
import { getTranslator } from "@/lib/i18n/server";
import { listPublished } from "@/lib/data/published";

export const dynamic = "force-dynamic";
export const metadata = { title: "Spiritual Guidance" };

export default async function SpiritualGuidancePage() {
  const { t } = await getTranslator();
  const items = await listPublished("MARIAN_TITLE");
  const apparitions = await listPublished("APPARITION");
  return (
    <div>
      <PageHero
        eyebrow={t("nav.spiritualGuidance")}
        title={t("spiritualGuidance.title")}
        subtitle={t("spiritualGuidance.subtitle")}
      />
      <h2 className="mt-12 mb-6 font-display text-2xl text-ink">Marian Titles</h2>
      <PublishedList items={items} baseHref="/spiritual-guidance" />
      <h2 className="mt-12 mb-6 font-display text-2xl text-ink">Approved Apparitions</h2>
      <PublishedList
        items={apparitions}
        baseHref="/spiritual-guidance"
        eyebrowField="approvedStatus"
      />
    </div>
  );
}
