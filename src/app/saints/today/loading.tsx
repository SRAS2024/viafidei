import { TabLoadingSkeleton } from "@/components/ui/TabLoadingSkeleton";
import { getTranslator } from "@/lib/i18n/server";

export default async function SaintsTodayLoading() {
  const { t } = await getTranslator();
  return (
    <div className="vf-grid-centred">
      <TabLoadingSkeleton
        eyebrow={t("saints.today.eyebrow")}
        title={t("saints.today.title")}
        cards={3}
        controls={false}
        metaLines={3}
        summary={false}
      />
    </div>
  );
}
