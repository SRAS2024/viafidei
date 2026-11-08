import { PageHero } from "@/components/ui";
import { CATHOLIC_RITES, RITE_LABEL_KEYS } from "@/lib/content-shared/rites";
import { getRiteCookieValue } from "@/lib/i18n/rite-cookie";
import { getTranslator } from "@/lib/i18n/server";

import { CALENDAR_HERO } from "./hero";
import { LiturgicalCalendarBrowser } from "./LiturgicalCalendarBrowser";

export const dynamic = "force-dynamic";
export const metadata = { title: "Liturgical Calendar" };

export default async function LiturgicalCalendarPage() {
  const { t } = await getTranslator();
  const rite = await getRiteCookieValue();
  const rites = CATHOLIC_RITES.map((value) => ({ value, label: t(RITE_LABEL_KEYS[value]) }));

  return (
    <div>
      <PageHero {...CALENDAR_HERO} />
      <LiturgicalCalendarBrowser
        rites={rites}
        initialRite={rite}
        loadingLabel={t("common.loadingCalendar")}
        outOfRangeLabel={t("calendar.outOfRange")}
      />
    </div>
  );
}
