import { TabLoadingSkeleton } from "@/components/ui/TabLoadingSkeleton";
import { getTranslator } from "@/lib/i18n/server";

export default async function SpiritualLifeLoading() {
  const { t } = await getTranslator();
  return (
    <TabLoadingSkeleton
      eyebrow={t("nav.spiritualLife")}
      title={t("spiritualLife.title")}
      subtitle={t("spiritualLife.subtitle")}
      cards={12}
      filterWidth="5.125rem"
    />
  );
}
