import Link from "next/link";
import type { Translator } from "@/lib/i18n/translator";
import { DASHBOARD_CARDS } from "./cards";

type Props = { t: Translator };

export function DashboardCardGrid({ t }: Props) {
  return (
    <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {DASHBOARD_CARDS.map((c) => {
        const description = c.descriptionKey ? t(c.descriptionKey) : null;
        // If the description key isn't in the dictionary the translator
        // returns the key itself; suppress that to avoid showing raw
        // i18n keys in the UI.
        const hasDescription = description && description !== c.descriptionKey;
        return (
          <Link
            key={c.href}
            href={c.href}
            className="vf-card group block min-h-[130px] rounded-sm p-6 transition hover:-translate-y-0.5 hover:border-ink/30"
          >
            <p className="vf-eyebrow">{c.eyebrow}</p>
            <h2 className="mt-3 font-display text-2xl">{t(c.labelKey)}</h2>
            {hasDescription && (
              <p className="mt-2 font-serif text-sm text-ink-soft">{description}</p>
            )}
          </Link>
        );
      })}
    </div>
  );
}
