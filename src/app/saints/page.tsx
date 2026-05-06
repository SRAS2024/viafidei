import { getTranslator } from "@/lib/i18n/server";
import { PageHero } from "@/components/ui/PageHero";
import { listPublishedSaints } from "@/lib/data/saints";
import { listPublishedApparitions } from "@/lib/data/apparitions";
import { SaintsGrid, ApparitionsGrid } from "./_components";
import { logPageError } from "@/lib/observability/page-errors";

export const dynamic = "force-dynamic";
export const metadata = { title: "Saints & Our Lady" };

export default async function SaintsPage() {
  const { t, locale } = await getTranslator();
  let saints: Awaited<ReturnType<typeof listPublishedSaints>> = [];
  let apparitions: Awaited<ReturnType<typeof listPublishedApparitions>> = [];
  try {
    [saints, apparitions] = await Promise.all([
      listPublishedSaints(locale),
      listPublishedApparitions(locale),
    ]);
  } catch (err) {
    logPageError({ route: "/saints", entityType: "Saint", error: err });
  }

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
