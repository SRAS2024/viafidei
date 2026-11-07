import type { Translator } from "@/lib/i18n/translator";

import { HomeSectionHead } from "./HomeSectionHead";

/** Section IV closes the page: why the site exists, and what the Church is. */
export function HomeMission({ t }: { t: Translator }) {
  return (
    <section className="vf-home-section" aria-labelledby="home-way-title">
      <HomeSectionHead n={4} id="home-way-title">
        {t("brand.tagline")}
      </HomeSectionHead>
      <div className="vf-home-pair">
        <div className="vf-card vf-home-panel">
          <h3 className="vf-subhead">{t("home.mission.title")}</h3>
          <p className="vf-reading text-ink-soft">{t("home.mission.body")}</p>
        </div>
        <div className="vf-card vf-home-panel">
          <h3 className="vf-subhead">{t("home.catholic.title")}</h3>
          <p className="vf-reading text-ink-soft">{t("home.catholic.body")}</p>
        </div>
      </div>
    </section>
  );
}
