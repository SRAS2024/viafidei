import { PageHero } from "@/components/ui";
import { getTranslator } from "@/lib/i18n/server";
import { listPublished } from "@/lib/data/published";
import { matchSacrament } from "@/lib/content-shared/sacraments";

import {
  SACRAMENT_GROUPS,
  SacramentCard,
  sacramentGridClass,
  sacramentGroupTitle,
  sacramentsOf,
} from "../groups";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sacraments" };

export default async function SacramentsPage() {
  const { t } = await getTranslator();
  const published = await listPublished("SACRAMENT");

  // Pair each published sacrament row with its canonical card so the tab shows
  // exactly the seven sacraments, each linking to its content when present.
  const slugByKey = new Map<string, string>();
  for (const item of published) {
    const match = matchSacrament(
      item.slug,
      item.title,
      (item.payload as Record<string, unknown>).sacramentKey as string | undefined,
    );
    if (match && !slugByKey.has(match.key)) slugByKey.set(match.key, item.slug);
  }

  return (
    <div>
      <PageHero
        eyebrow={t("nav.sacraments")}
        title={t("sacraments.title")}
        subtitle={t("sacraments.subtitle")}
      />
      <div className="vf-sacrament-groups">
        {SACRAMENT_GROUPS.map((group) => (
          <section key={group.key} aria-labelledby={`sacraments-${group.key}`}>
            <div className="vf-section-head">
              <h2 id={`sacraments-${group.key}`} className="vf-section-title">
                {sacramentGroupTitle(t, group)}
              </h2>
            </div>
            {/* Safari stops calling a list a list once its markers are gone. */}
            <ul className={sacramentGridClass(group)} role="list">
              {sacramentsOf(group).map((sacrament) => (
                <li key={sacrament.key}>
                  <SacramentCard sacrament={sacrament} slug={slugByKey.get(sacrament.key)} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
