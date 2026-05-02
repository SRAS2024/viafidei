import Link from "next/link";
import type { Translator } from "@/lib/i18n/translator";

export type FeaturedPrayer = { title: string; category: string; href: string };

export const FEATURED_PRAYERS: FeaturedPrayer[] = [
  { title: "Pater Noster", category: "Dominical", href: "/prayers" },
  { title: "Ave Maria", category: "Marian", href: "/prayers" },
  { title: "Anima Christi", category: "Eucharistic", href: "/prayers" },
];

export function HomeFeatured({ t, items = FEATURED_PRAYERS }: { t: Translator; items?: FeaturedPrayer[] }) {
  return (
    <section>
      <div className="mb-10 text-center">
        <p className="vf-eyebrow">IV.</p>
        <h2 className="mt-3 font-display text-4xl">{t("home.featured.title")}</h2>
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        {items.map((p) => (
          <Link
            key={p.title}
            href={p.href}
            className="vf-card block rounded-sm p-8 transition hover:border-ink/30"
          >
            <p className="vf-eyebrow">{p.category}</p>
            <h3 className="mt-3 font-display text-2xl">{p.title}</h3>
            <p className="mt-4 font-serif text-sm text-ink-faint">Open prayer →</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
