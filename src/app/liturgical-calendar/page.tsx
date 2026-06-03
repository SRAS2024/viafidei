import { PageHero } from "@/components/ui";
import { CATHOLIC_RITES, RITE_LABEL_KEYS } from "@/lib/content-shared/rites";
import { getRiteCookieValue } from "@/lib/i18n/rite-cookie";
import { getTranslator } from "@/lib/i18n/server";

import { LiturgicalCalendarBrowser } from "./LiturgicalCalendarBrowser";

export const dynamic = "force-dynamic";
export const metadata = { title: "Liturgical Calendar" };

export default async function LiturgicalCalendarPage() {
  const { t } = await getTranslator();
  const rite = await getRiteCookieValue();
  const rites = CATHOLIC_RITES.map((value) => ({ value, label: t(RITE_LABEL_KEYS[value]) }));

  return (
    <div>
      <PageHero
        eyebrow="The Church's Year"
        title="Liturgical Calendar"
        subtitle="The season, liturgical colour, and lectionary cycle for any day, with a link to the day's official Mass readings."
      />
      <div className="mx-auto max-w-2xl px-4 pb-12">
        <LiturgicalCalendarBrowser rites={rites} initialRite={rite} />
      </div>
    </div>
  );
}
