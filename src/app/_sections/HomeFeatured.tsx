import Link from "next/link";
import type { Translator } from "@/lib/i18n/translator";

export type FeaturedPrayer = { id: string; title: string; category: string; slug: string };

const FALLBACK_PRAYERS: FeaturedPrayer[] = [
  { id: "fallback-1", title: "Pater Noster", category: "Dominical", slug: "pater-noster" },
  { id: "fallback-2", title: "Ave Maria", category: "Marian", slug: "ave-maria" },
  { id: "fallback-3", title: "Anima Christi", category: "Eucharistic", slug: "anima-christi" },
];

export function HomeFeatured({ t, items }: { t: Translator; items?: FeaturedPrayer[] }) {
  const prayers = items && items.length > 0 ? items : FALLBACK_PRAYERS;
  return (
    <section>
      <div className="mb-10 text-center">
        <p className="vf-eyebrow">IV.</p>
        <h2 className="mt-3 font-display text-4xl">{t("home.featured.title")}</h2>
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        {prayers.map((p) => (
          <Link
            key={p.id}
            href={`/prayers/${p.slug}`}
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
