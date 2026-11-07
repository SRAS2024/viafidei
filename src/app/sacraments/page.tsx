import { PageHero } from "@/components/ui";
import { getTranslator } from "@/lib/i18n/server";
import type { Translator } from "@/lib/i18n/translator";
import { listPublished } from "@/lib/data/published";
import { matchSacrament } from "@/lib/content-shared/sacraments";

import { SACRAMENT_GROUPS, SacramentCard, sacramentGridClass, sacramentsOf } from "./groups";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sacraments" };

/** A label through the dictionaries, in English until a dictionary carries it. */
function label(t: Translator, key: string, english: string): string {
  const text = t(key);
  return text === key ? english : text;
}

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
                {label(t, group.titleKey, group.title)}
              </h2>
            </div>
            <ul className={sacramentGridClass(group)}>
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
