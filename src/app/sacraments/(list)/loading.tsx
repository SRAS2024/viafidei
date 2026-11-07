import { PageHero } from "@/components/ui/PageHero";
import { LoadingStatus } from "@/components/ui/TabLoadingSkeleton";
import { getTranslator } from "@/lib/i18n/server";

import {
  SACRAMENT_GROUPS,
  SacramentCard,
  sacramentGridClass,
  sacramentGroupTitle,
  sacramentsOf,
} from "../groups";

/**
 * The seven sacraments never change, so the placeholder is the finished page with
 * its cards not yet links: nothing moves when the content arrives.
 */
export default async function SacramentsLoading() {
  const { t } = await getTranslator();
  return (
    <>
      <LoadingStatus>{t("common.loadingContent")}</LoadingStatus>
      <div aria-busy="true" data-testid="tab-loading">
        <PageHero
          eyebrow={t("nav.sacraments")}
          title={t("sacraments.title")}
          subtitle={t("sacraments.subtitle")}
        />
        <div className="vf-sacrament-groups" aria-hidden="true">
          {SACRAMENT_GROUPS.map((group) => (
            <section key={group.key}>
              <div className="vf-section-head">
                <h2 className="vf-section-title">{sacramentGroupTitle(t, group)}</h2>
              </div>
              <ul className={sacramentGridClass(group)}>
                {sacramentsOf(group).map((sacrament) => (
                  <li key={sacrament.key}>
                    <SacramentCard sacrament={sacrament} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </>
  );
}
