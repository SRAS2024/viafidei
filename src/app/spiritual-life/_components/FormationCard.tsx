import type { Translator } from "@/lib/i18n/translator";
import { toneClass, type FormationItem } from "./formationItems";

type Props = {
  item: FormationItem;
  t: Translator;
};

export function FormationCard({ item, t }: Props) {
  return (
    <article id={item.id} className="vf-card flex flex-col rounded-sm p-8">
      <div className={`mb-4 ${toneClass(item.tone)}`}>{item.icon}</div>
      <p className="vf-eyebrow">Formation</p>
      <h2 className="mt-3 font-display text-3xl">{t(item.key)}</h2>
      <p className="mt-4 flex-1 font-serif leading-relaxed text-ink-soft">
        Step-by-step guide, readings, and devotional pacing.
      </p>
      <div className="mt-6 flex">
        <button type="button" className="vf-btn vf-btn-ghost">
          {t("spiritualLife.addGoal")}
        </button>
      </div>
    </article>
  );
}
