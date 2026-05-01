import Link from "next/link";
import type { Translator } from "@/lib/i18n/translator";

export type NavItem = { href: string; key: string };

export const PRIMARY_NAV: NavItem[] = [
  { href: "/", key: "nav.home" },
  { href: "/prayers", key: "nav.prayers" },
  { href: "/spiritual-life", key: "nav.spiritualLife" },
  { href: "/spiritual-guidance", key: "nav.spiritualGuidance" },
  { href: "/liturgy-history", key: "nav.liturgyHistory" },
  { href: "/saints", key: "nav.saints" },
];

type Props = {
  items?: NavItem[];
  t: Translator;
};

export function HeaderNav({ items = PRIMARY_NAV, t }: Props) {
  return (
    <nav
      aria-label="Primary"
      className="flex w-full flex-wrap items-center justify-center gap-x-6 gap-y-3 sm:gap-x-7"
    >
      {items.map((item) => (
        <Link key={item.href} href={item.href} className="vf-nav-link">
          {t(item.key)}
        </Link>
      ))}
    </nav>
  );
}
