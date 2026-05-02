import { getTranslator } from "@/lib/i18n/server";
import { PageHero } from "@/components/ui/PageHero";
import { listPublishedSaints } from "@/lib/data/saints";
import { listPublishedApparitions } from "@/lib/data/apparitions";
import { SaintsGrid, ApparitionsGrid } from "./_components";

export const revalidate = 3600;
export const metadata = { title: "Saints & Our Lady" };

export default async function SaintsPage() {
  const { t, locale } = await getTranslator();
  const [saints, apparitions] = await Promise.all([
    listPublishedSaints(locale),
    listPublishedApparitions(locale),
  ]);

  return (
    <div>
      <PageHero
        eyebrow={t("nav.saints")}
        title={t("saints.title")}
        subtitle={t("saints.subtitle")}
      />
      <SaintsGrid
        saints={saints}
        feastDayLabel={t("saints.feastDay")}
        emptyMessage="Saints dataset will appear here as it is seeded and published."
      />
      <ApparitionsGrid
        apparitions={apparitions}
        heading="Approved Marian apparitions"
        emptyMessage="Approved apparition entries will appear here."
      />
    </div>
  );
}
