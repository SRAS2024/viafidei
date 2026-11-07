import { PageHero } from "@/components/ui/PageHero";
import { getTranslator } from "@/lib/i18n/server";

import { CalendarPanelSkeleton } from "./CalendarPanelSkeleton";
import { CALENDAR_HERO } from "./hero";

/** The same opening and panel as the finished page, so nothing moves when it loads. */
export default async function LiturgicalCalendarLoading() {
  const { t } = await getTranslator();
  return (
    <div data-testid="tab-loading">
      <PageHero {...CALENDAR_HERO} />
      <CalendarPanelSkeleton loadingLabel={t("common.loadingCalendar")} />
    </div>
  );
}
