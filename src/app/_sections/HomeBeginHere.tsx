import type { Translator } from "@/lib/i18n/translator";

import { HomeNewcomer } from "./HomeNewcomer";
import { HomeQuickLinks } from "./HomeQuickLinks";
import { HomeSectionHead } from "./HomeSectionHead";

/**
 * Section I: one composition for anyone starting out. The welcome for someone
 * new to the faith on one side, the five first places to go on the other.
 */
export function HomeBeginHere({ t }: { t: Translator }) {
  return (
    <section className="vf-home-section" aria-labelledby="home-begin-title">
      <HomeSectionHead n={1} id="home-begin-title">
        {t("home.quickLinks.title")}
      </HomeSectionHead>
      <div className="vf-card vf-home-begin">
        <HomeNewcomer t={t} />
        <HomeQuickLinks t={t} labelledBy="home-begin-title" />
      </div>
    </section>
  );
}
