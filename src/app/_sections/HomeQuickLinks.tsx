import Link from "next/link";
import type { Translator } from "@/lib/i18n/translator";

export type QuickLink = { href: string; key: string };

export const QUICK_LINKS: QuickLink[] = [
  { href: "/spiritual-life#sacraments", key: "home.ql.sacraments" },
  { href: "/spiritual-life#ocia", key: "home.ql.ocia" },
  { href: "/spiritual-life#rosary", key: "home.ql.rosary" },
  { href: "/spiritual-life#confession", key: "home.ql.confession" },
  { href: "/spiritual-guidance", key: "home.ql.parish" },
];

export function HomeQuickLinks({ t, links = QUICK_LINKS }: { t: Translator; links?: QuickLink[] }) {
  return (
    <section>
      <div className="mb-10 text-center">
        <p className="vf-eyebrow">III.</p>
        <h2 className="mt-3 font-display text-4xl">{t("home.quickLinks.title")}</h2>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {links.map((link) => (
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
  );
}
