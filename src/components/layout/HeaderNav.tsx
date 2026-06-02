import type { Translator } from "@/lib/i18n/translator";
import { HeaderNavClient, type NavItem as ClientNavItem } from "./HeaderNavClient";

export type NavItem = { href: string; key: string };

export const PRIMARY_NAV: NavItem[] = [
  { href: "/", key: "nav.home" },
  { href: "/prayers", key: "nav.prayers" },
  { href: "/sacraments", key: "nav.sacraments" },
  { href: "/spiritual-life", key: "nav.spiritualLife" },
  { href: "/our-lady", key: "nav.spiritualGuidance" },
  { href: "/liturgy", key: "nav.liturgy" },
  { href: "/liturgical-calendar", key: "nav.liturgicalCalendar" },
  { href: "/history", key: "nav.history" },
  { href: "/saints", key: "nav.saints" },
  { href: "/popes", key: "nav.popes" },
  { href: "/doctors", key: "nav.doctors" },
  { href: "/parishes", key: "nav.parishes" },
  { href: "/rites", key: "nav.rites" },
];

type Props = {
  items?: NavItem[];
  t: Translator;
};

export function HeaderNav({ items = PRIMARY_NAV, t }: Props) {
  const enriched: ClientNavItem[] = items.map((item) => ({ ...item, label: t(item.key) }));
  return <HeaderNavClient items={enriched} />;
}
