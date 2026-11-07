import { PageHero } from "@/components/ui/PageHero";

import { CalendarPanelSkeleton } from "./CalendarPanelSkeleton";
import { CALENDAR_HERO } from "./hero";

/** The same opening and panel as the finished page, so nothing moves when it loads. */
export default function LiturgicalCalendarLoading() {
  return (
    <div data-testid="tab-loading">
      <PageHero {...CALENDAR_HERO} />
      <CalendarPanelSkeleton />
    </div>
  );
}
