import type { Locale } from "@/lib/i18n/locales";
import type { Translator } from "@/lib/i18n/translator";

import { HomeNumeral } from "./HomeSectionHead";
import { HomePrayerOfTheDay } from "./HomePrayerOfTheDay";
import { HomeToday } from "./HomeToday";
import { LiturgicalToday } from "./LiturgicalToday";
import { TodayDateHeading } from "./TodayDateHeading";
import { todayWords } from "./today-words";

/**
 * Section II: the day itself. The visitor's date as the heading, then the day's
 * readings, prayer and saints as three balanced parts. Each part is a client
 * component that reads the device's date after mount, and reserves its finished
 * shape with placeholders until then, so nothing moves when the content arrives.
 */
export function HomeTodaySection({ t, locale = "en" }: { t: Translator; locale?: Locale }) {
  const words = todayWords(t);
  return (
    <section className="vf-home-section" aria-labelledby="home-today-title">
      <div className="vf-section-head">
        <HomeNumeral n={2} />
        <TodayDateHeading
          id="home-today-title"
          locale={locale}
          todayLabel={words["home.today.label"]}
        />
      </div>
      <div className="vf-home-today">
        <LiturgicalToday loadingLabel={t("common.loadingLiturgy")} words={words} locale={locale} />
        <HomePrayerOfTheDay loadingLabel={t("common.loadingPrayer")} />
        <HomeToday loadingLabel={t("common.loadingSaints")} errorLabel={t("home.saints.error")} />
      </div>
    </section>
  );
}
