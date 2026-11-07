import type { Translator } from "@/lib/i18n/translator";

import { HomeNumeral } from "./HomeSectionHead";

/** Section IV closes the page: why the site exists, and what the Church is. */
export function HomeMission({ t }: { t: Translator }) {
  return (
    <section className="vf-home-section" aria-labelledby="home-mission-title home-catholic-title">
      <div className="vf-section-head mb-3">
        <HomeNumeral n={4} />
      </div>
      <div className="vf-home-pair">
        <div className="vf-card vf-home-panel">
          <h2 id="home-mission-title" className="vf-subhead">
            {t("home.mission.title")}
          </h2>
          <p className="vf-reading text-ink-soft">{t("home.mission.body")}</p>
        </div>
        <div className="vf-card vf-home-panel">
          <h2 id="home-catholic-title" className="vf-subhead">
            {t("home.catholic.title")}
          </h2>
          <p className="vf-reading text-ink-soft">{t("home.catholic.body")}</p>
        </div>
      </div>
    </section>
  );
}
