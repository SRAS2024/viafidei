import { TabLoadingSkeleton } from "@/components/ui/TabLoadingSkeleton";
import { getTranslator } from "@/lib/i18n/server";

export default async function PrayersLoading() {
  const { t } = await getTranslator();
  return (
    <TabLoadingSkeleton
      eyebrow={t("nav.prayers")}
      title={t("prayers.title")}
      lede={false}
      cards={12}
      filterWidth="5.125rem"
      summary={false}
    />
  );
}
