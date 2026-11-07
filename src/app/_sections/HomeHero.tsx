import Link from "next/link";
import type { Translator } from "@/lib/i18n/translator";

export function HomeHero({ t }: { t: Translator }) {
  return (
    <section className="vf-home-hero">
      <p className="vf-home-tagline">{t("brand.tagline")}</p>
      <div className="vf-rule" />
      <h1 className="vf-home-title">{t("home.title")}</h1>
      <p className="vf-page-hero-lede">{t("home.lede")}</p>
      <div className="vf-home-actions">
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
