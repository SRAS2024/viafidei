import { getTranslator } from "@/lib/i18n/server";
import { PageHero } from "@/components/PageHero";

export const metadata = { title: "Spiritual Life" };

type Item = {
  id: string;
  key: string;
  /** Marian / Eucharistic accents are the only places color is allowed. */
  tone?: "marian" | "eucharist" | "ink";
  icon: React.ReactNode;
};

const ROSARY_ICON = (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="9" r="3" />
    <path d="M12 12 v 4" />
    <path d="M10 16 h 4" />
    <circle cx="6" cy="6" r="0.8" />
    <circle cx="18" cy="6" r="0.8" />
    <circle cx="4" cy="11" r="0.8" />
    <circle cx="20" cy="11" r="0.8" />
    <circle cx="6" cy="16" r="0.8" />
    <circle cx="18" cy="16" r="0.8" />
  </svg>
);

const CONFESSION_ICON = (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 21 V 6 a 2 2 0 0 1 2 -2 h 10 a 2 2 0 0 1 2 2 V 21" />
    <path d="M12 4 V 14" />
    <path d="M9 8 H 15" />
  </svg>
);

const ADORATION_ICON = (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="3.2" />
    <g opacity="0.85">
      <path d="M12 4 V 6.5" />
      <path d="M12 17.5 V 20" />
      <path d="M4 12 H 6.5" />
      <path d="M17.5 12 H 20" />
      <path d="M6.4 6.4 L 8 8" />
      <path d="M16 16 L 17.6 17.6" />
      <path d="M6.4 17.6 L 8 16" />
      <path d="M16 8 L 17.6 6.4" />
    </g>
  </svg>
);

const CONSECRATION_ICON = (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 4 C 8 8 8 13 12 20 C 16 13 16 8 12 4 Z" />
    <path d="M12 8 V 16" />
  </svg>
);

const VOCATIONS_ICON = (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 20 V 10 L 12 5 L 19 10 V 20 Z" />
    <path d="M12 5 V 20" />
    <path d="M9 13 H 15" />
  </svg>
);

export default async function SpiritualLifePage() {
  const { t } = await getTranslator();
  const items: Item[] = [
    { id: "rosary", key: "spiritualLife.rosary", tone: "marian", icon: ROSARY_ICON },
    { id: "confession", key: "spiritualLife.confession", tone: "ink", icon: CONFESSION_ICON },
    { id: "adoration", key: "spiritualLife.adoration", tone: "eucharist", icon: ADORATION_ICON },
    { id: "consecration", key: "spiritualLife.consecration", tone: "marian", icon: CONSECRATION_ICON },
    { id: "vocations", key: "spiritualLife.vocations", tone: "ink", icon: VOCATIONS_ICON },
  ];

  const toneClass = (tone: Item["tone"]) =>
    tone === "marian"
      ? "vf-icon-marian"
      : tone === "eucharist"
        ? "vf-icon-eucharist"
        : "text-ink";

  return (
    <div>
      <PageHero
        eyebrow={t("nav.spiritualLife")}
        title={t("spiritualLife.title")}
        subtitle={t("spiritualLife.subtitle")}
      />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((i) => (
          <article id={i.id} key={i.id} className="vf-card flex flex-col rounded-sm p-8">
            <div className={`mb-4 ${toneClass(i.tone)}`}>{i.icon}</div>
            <p className="vf-eyebrow">Formation</p>
            <h2 className="mt-3 font-display text-3xl">{t(i.key)}</h2>
            <p className="mt-4 flex-1 font-serif leading-relaxed text-ink-soft">
              Step-by-step guide, readings, and devotional pacing.
            </p>
            <div className="mt-6 flex">
              <button type="button" className="vf-btn vf-btn-ghost">
                {t("spiritualLife.addGoal")}
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
