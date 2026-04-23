import Link from "next/link";
import { getTranslator } from "@/lib/i18n/server";

export default async function HomePage() {
  const { t } = await getTranslator();

  const quickLinks = [
    { href: "/spiritual-life#sacraments", key: "home.ql.sacraments" },
    { href: "/spiritual-life#ocia", key: "home.ql.ocia" },
    { href: "/spiritual-life#rosary", key: "home.ql.rosary" },
    { href: "/spiritual-life#confession", key: "home.ql.confession" },
    { href: "/spiritual-guidance", key: "home.ql.parish" },
  ];

  const featured = [
    { title: "Pater Noster", category: "Dominical", href: "/prayers" },
    { title: "Ave Maria", category: "Marian", href: "/prayers" },
    { title: "Anima Christi", category: "Eucharistic", href: "/prayers" },
  ];

  return (
    <div className="flex flex-col gap-24">
      <section className="pt-10 pb-6 text-center">
        <p className="vf-eyebrow">{t("home.eyebrow")}</p>
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

      <section className="grid gap-10 md:grid-cols-2">
        <article className="vf-card rounded-sm p-10">
          <p className="vf-eyebrow">I.</p>
          <h2 className="mt-3 font-display text-3xl">{t("home.mission.title")}</h2>
          <p className="mt-5 font-serif text-lg leading-relaxed text-ink-soft">
            {t("home.mission.body")}
          </p>
        </article>
        <article className="vf-card rounded-sm p-10">
          <p className="vf-eyebrow">II.</p>
          <h2 className="mt-3 font-display text-3xl">{t("home.catholic.title")}</h2>
          <p className="mt-5 font-serif text-lg leading-relaxed text-ink-soft">
            {t("home.catholic.body")}
          </p>
        </article>
      </section>

      <section>
        <div className="mb-10 text-center">
          <p className="vf-eyebrow">III.</p>
          <h2 className="mt-3 font-display text-4xl">{t("home.quickLinks.title")}</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {quickLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="vf-card flex min-h-[120px] items-center justify-center rounded-sm p-6 text-center font-serif text-lg text-ink transition hover:-translate-y-0.5 hover:border-ink/30"
            >
              {t(link.key)}
            </Link>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-10 text-center">
          <p className="vf-eyebrow">IV.</p>
          <h2 className="mt-3 font-display text-4xl">{t("home.featured.title")}</h2>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {featured.map((p) => (
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

      <section className="vf-card rounded-sm p-12 text-center">
        <p className="vf-eyebrow">V.</p>
        <h2 className="mt-3 font-display text-4xl">{t("home.newcomer.title")}</h2>
        <p className="mx-auto mt-5 max-w-reading font-serif text-lg leading-relaxed text-ink-soft">
          {t("home.newcomer.body")}
        </p>
        <div className="mt-8 flex justify-center">
          <Link href="/spiritual-life" className="vf-btn vf-btn-primary">
            {t("nav.spiritualLife")}
          </Link>
        </div>
      </section>
    </div>
  );
}
