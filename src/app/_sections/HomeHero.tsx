import Link from "next/link";
import type { Translator } from "@/lib/i18n/translator";

export function HomeHero({ t }: { t: Translator }) {
  return (
    <section className="pt-10 pb-6 text-center">
      <p className="vf-eyebrow">{t("home.eyebrow")}</p>
      <p className="mt-4 font-display text-2xl italic text-ink-soft sm:text-3xl">
        {t("brand.tagline")}
      </p>
      <div className="vf-rule mx-auto my-6" />
      <h1 className="font-display text-balance text-5xl leading-[1.05] text-ink sm:text-6xl md:text-7xl">
        {t("home.title")}
      </h1>
      <p className="mx-auto mt-8 max-w-reading text-pretty font-serif text-lg leading-relaxed text-ink-soft">
        {t("home.lede")}
      </p>
      <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
        <Link href="/prayers" className="vf-btn vf-btn-primary">
          {t("home.ctaExplore")}
        </Link>
        <Link href="/register" className="vf-btn vf-btn-ghost">
          {t("home.ctaJoin")}
        </Link>
      </div>
    </section>
  );
}
