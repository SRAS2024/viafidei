import { TabLoadingSkeleton } from "@/components/ui/TabLoadingSkeleton";
import { getTranslator } from "@/lib/i18n/server";

export default async function SaintsLoading() {
  const { t } = await getTranslator();
  return (
    <TabLoadingSkeleton
      eyebrow={t("nav.saints")}
      title={t("saints.title")}
      subtitle={t("saints.subtitle")}
      cards={12}
      filterWidth="5.125rem"
      metaLines={3}
      summary={false}
    />
  );
}
