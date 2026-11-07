import { HomeNumeral } from "./HomeSectionHead";
import { HomePrayerOfTheDay } from "./HomePrayerOfTheDay";
import { HomeToday } from "./HomeToday";
import { LiturgicalToday } from "./LiturgicalToday";
import { TodayDateHeading } from "./TodayDateHeading";

/**
 * Section II: the day itself. The visitor's date as the heading, then the day's
 * readings, prayer and saints as three balanced parts. Each part is a client
 * component that reads the device's date after mount, and reserves its finished
 * shape with placeholders until then, so nothing moves when the content arrives.
 */
export function HomeTodaySection() {
  return (
    <section className="vf-home-section" aria-labelledby="home-today-title">
      <div className="vf-section-head">
        <HomeNumeral n={2} />
        <TodayDateHeading id="home-today-title" />
      </div>
      <div className="vf-home-today">
        <LiturgicalToday />
        <HomePrayerOfTheDay />
        <HomeToday />
      </div>
    </section>
  );
}
